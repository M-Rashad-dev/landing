<?php

declare(strict_types=1);

namespace App\Ai\Designer;

use App\Ai\Ai;
use App\Ai\AiUnavailable;
use App\Ai\AiWallets;
use App\Ai\Images\StockPhotos;
use App\Exceptions\ApiException;
use App\Jobs\DesignerReply;
use App\Models\AiChat;
use App\Models\AiChatMessage;
use App\Models\AiDesignRun;
use App\Models\AiSection;
use App\Models\AiSectionVersion;
use App\Models\AiWalletEntry;
use App\Models\LandingPage;
use App\Models\Media;
use App\Models\Store;
use App\Models\StoreDesign;
use App\Models\Tenant;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;
use Throwable;

/**
 * Core service for «المصمم الذكي» (docs/plans/ai-designer.md §2.4 & §3.5): manages chats, message queuing,
 * AI replies with automatic 1-turn repair, image processing/generation/stock, and version approval/rejection.
 */
final class AiDesigner
{
    public const MAX_OUTPUT_TOKENS = 12000;

    public const MAX_JSON_BYTES = 200000;

    public const MAX_REPLY_IMAGES = 6;

    private const HISTORY_LIMIT = 12;

    private const IMAGE_MAX_BYTES = 5_000_000;

    private const FAKE_DATA_URL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

    public function __construct(
        private readonly Ai $ai,
        private readonly AiWallets $wallets,
        private readonly AiSectionBuilder $builder,
        private readonly AiImages $images,
        private readonly StockPhotos $stock,
        private readonly AiDesignRunner $runner,
    ) {}

    public function enabled(): bool
    {
        return $this->ai->blocker('designer') === null;
    }

    /**
     * Find or create the open chat for a store+theme or a landing page.
     */
    public function chat(Tenant $tenant, string $kind, string $themeKey, ?int $landingPageId = null): AiChat
    {
        $pageId = $this->validateTarget($kind, $themeKey, $landingPageId);

        $chat = AiChat::query()
            ->where('kind', $kind)
            ->where('theme_key', $themeKey)
            ->where('landing_page_id', $pageId)
            ->whereNull('closed_at')
            ->latest('id')
            ->first();

        if ($chat instanceof AiChat) {
            $this->expireStalePending($chat);

            return $chat;
        }

        return AiChat::query()->create([
            'kind' => $kind,
            'theme_key' => $themeKey,
            'landing_page_id' => $pageId,
        ]);
    }

    /**
     * Close the current open chat and start a fresh empty one («محادثة جديدة»).
     */
    public function newChat(Tenant $tenant, string $kind, string $themeKey, ?int $landingPageId = null): AiChat
    {
        $pageId = $this->validateTarget($kind, $themeKey, $landingPageId);

        return DB::transaction(function () use ($kind, $themeKey, $pageId): AiChat {
            AiChat::query()
                ->where('kind', $kind)
                ->where('theme_key', $themeKey)
                ->where('landing_page_id', $pageId)
                ->whereNull('closed_at')
                ->update(['closed_at' => now()]);

            return AiChat::query()->create([
                'kind' => $kind,
                'theme_key' => $themeKey,
                'landing_page_id' => $pageId,
            ]);
        });
    }

    /**
     * Mark any pending message older than 5 minutes as failed (no charge was taken).
     */
    public function expireStalePending(AiChat $chat): void
    {
        AiChatMessage::query()
            ->where('chat_id', $chat->id)
            ->where('status', 'pending')
            ->where('created_at', '<=', now()->subMinutes(5))
            ->update([
                'status' => 'failed',
                'error' => __('ai.designer.timeout'),
            ]);
    }

    /**
     * Queue a merchant message and a pending assistant message inside a single transaction.
     *
     * @param  list<int>  $mediaIds
     */
    public function send(
        Tenant $tenant,
        AiChat $chat,
        string $text,
        array $mediaIds = [],
        ?int $focusSectionId = null,
    ): AiChatMessage {
        $this->expireStalePending($chat);

        if ($chat->closed_at !== null) {
            throw new ApiException(422, 'ai_chat_full', __('ai.designer.chat_full'));
        }

        return DB::transaction(function () use ($tenant, $chat, $text, $mediaIds, $focusSectionId): AiChatMessage {
            $count = AiChatMessage::query()->where('chat_id', $chat->id)->lockForUpdate()->count();
            if ($count >= AiChat::MAX_MESSAGES) {
                throw new ApiException(422, 'ai_chat_full', __('ai.designer.chat_full'));
            }

            $hasPending = AiChatMessage::query()
                ->where('chat_id', $chat->id)
                ->where('status', 'pending')
                ->exists();
            if ($hasPending) {
                throw new ApiException(422, 'ai_reply_pending', __('ai.designer.reply_pending'));
            }

            if ($this->ai->blocker('designer') !== null) {
                throw new ApiException(422, 'ai_unavailable', __('ai.wallet.unavailable'));
            }

            // Up-front balance check before saving anything
            $promptText = $this->systemPrompt()."\n".$text;
            $estimateContent = [['type' => 'text', 'text' => $promptText]];
            foreach ($mediaIds as $_) {
                $estimateContent[] = ['type' => 'image', 'url' => 'data:image/webp;base64,'];
            }
            $estimatedUsd = Ai::estimate(
                Ai::model('designer'),
                [['role' => 'user', 'content' => $estimateContent]],
                self::MAX_OUTPUT_TOKENS,
            );
            $this->wallets->ensureCanSpend($tenant, $estimatedUsd);

            if ($focusSectionId !== null) {
                $focus = AiSection::query()->with('current')->find($focusSectionId);
                if (
                    ! $focus instanceof AiSection
                    || $focus->kind !== $chat->kind
                    || $focus->theme_key !== $chat->theme_key
                    || $focus->current === null
                ) {
                    throw new ApiException(422, 'wrong_theme', __('ai.sections.wrong_theme'));
                }
            }

            $cleanMediaIds = array_values(array_unique(array_map('intval', $mediaIds)));
            if (count($cleanMediaIds) > AiChatMessage::MAX_IMAGES) {
                throw ValidationException::withMessages(['media_ids' => [__('validation.max.array', ['attribute' => 'media_ids', 'max' => AiChatMessage::MAX_IMAGES])]]);
            }
            if ($cleanMediaIds !== []) {
                $foundCount = Media::query()->whereIn('id', $cleanMediaIds)->count();
                if ($foundCount !== count($cleanMediaIds)) {
                    throw ValidationException::withMessages(['media_ids' => [__('validation.exists', ['attribute' => 'media_ids'])]]);
                }
            }

            AiChatMessage::query()->create([
                'chat_id' => $chat->id,
                'role' => 'user',
                'text' => trim($text),
                'media_ids' => $cleanMediaIds === [] ? null : $cleanMediaIds,
                'focus_section_id' => $focusSectionId,
                'status' => 'done',
            ]);

            $assistant = AiChatMessage::query()->create([
                'chat_id' => $chat->id,
                'role' => 'assistant',
                'focus_section_id' => $focusSectionId,
                'status' => 'pending',
            ]);

            DesignerReply::dispatch($tenant->id, $assistant->id)->afterCommit();

            return $assistant;
        });
    }

    /**
     * Execute the AI call for a pending assistant message (run inside the tenant from DesignerReply job).
     * Never throws out of the job.
     */
    public function reply(AiChatMessage $pending): void
    {
        if ($pending->status !== 'pending') {
            return;
        }

        try {
            $pending->loadMissing('chat');
            $chat = $pending->chat;
            $tenant = Tenant::query()->find($pending->tenant_id);
            if (! $chat instanceof AiChat || ! $tenant instanceof Tenant) {
                $this->failMessage($pending, __('ai.designer.unavailable'));

                return;
            }

            $focusSection = null;
            if ($pending->focus_section_id !== null) {
                $focus = AiSection::query()->with('current')->find($pending->focus_section_id);
                if ($focus instanceof AiSection && $focus->kind === $chat->kind && $focus->theme_key === $chat->theme_key && $focus->current !== null) {
                    $focusSection = $focus;
                }
            }

            $messages = $this->buildPromptMessages($tenant, $chat, $pending, $focusSection);

            $reply = $this->ai->chatPaid(
                $tenant,
                'designer',
                'designer',
                $messages,
                ['max_tokens' => self::MAX_OUTPUT_TOKENS, 'json' => true],
                'المصمم الذكي: رد',
            );

            $firstUsage = $this->ai->lastUsage();
            $validated = $this->validateReplyJson($reply->text, $chat);

            // One repair turn when JSON or section validation fails
            if ($validated['errors'] !== []) {
                $repairMessages = [
                    ...$messages,
                    ['role' => 'assistant', 'content' => mb_substr($reply->text, 0, 40000, 'UTF-8')],
                    [
                        'role' => 'user',
                        'content' => "Your JSON broke these rules:\n- ".implode("\n- ", $validated['errors'])."\nReturn the corrected full JSON only.",
                    ],
                ];

                $repairReply = $this->ai->chatPaid(
                    $tenant,
                    'designer',
                    'designer',
                    $repairMessages,
                    ['max_tokens' => self::MAX_OUTPUT_TOKENS, 'json' => true],
                    'المصمم الذكي: إصلاح',
                );

                $validated = $this->validateReplyJson($repairReply->text, $chat);
            }

            if ($validated['errors'] !== []) {
                Log::warning('ai.designer.invalid_output', [
                    'stage' => 'reply_json',
                    'chat_id' => $chat->id,
                    'message_id' => $pending->id,
                    'errors' => $validated['errors'],
                    'raw_preview' => mb_substr($validated['raw_text'], 0, 500, 'UTF-8'),
                ]);
                $this->failMessage($pending, __('ai.designer.invalid_output'));

                return;
            }

            $replyText = $validated['reply'];
            $imageItems = $validated['images'];
            $sectionData = $validated['section'];
            $planData = $validated['plan'];
            $hasDirectDesign = $validated['action'] === 'design';

            // 1. Run image actions first (if any), up to 6 per reply
            $createdMediaIds = [];
            $mediaByKey = [];
            $imageFailures = [];

            if ($imageItems !== []) {
                $newestUserMsg = AiChatMessage::query()
                    ->where('chat_id', $chat->id)
                    ->where('id', '<', $pending->id)
                    ->where('role', 'user')
                    ->orderByDesc('id')
                    ->first();

                $imgResult = $this->executeImageTasks($tenant, $newestUserMsg, $imageItems);
                $createdMediaIds = $imgResult['media_ids'];
                $mediaByKey = $imgResult['by_key'];
                $imageFailures = $imgResult['failures'];
            }

            // 2. Direct follow-up design (Stage 5.1)
            $directRun = null;
            if ($hasDirectDesign) {
                $directRunResult = $this->runner->createDirectDesignRun(
                    $tenant,
                    $chat,
                    $validated['raw_text'],
                    $messages,
                    $mediaByKey,
                );
                if (is_array($directRunResult)) {
                    Log::warning('ai.designer.invalid_output', [
                        'stage' => 'direct_design',
                        'chat_id' => $chat->id,
                        'message_id' => $pending->id,
                        'errors' => $directRunResult,
                    ]);
                    $this->failMessage($pending, __('ai.designer.invalid_output'));

                    return;
                }
                $directRun = $directRunResult;
            }

            // 3. Build the section (if present), linking generated images as `image` field samples
            $version = null;
            if (! $hasDirectDesign && is_array($sectionData)) {
                if ($createdMediaIds !== [] && is_array($sectionData['fields'] ?? null)) {
                    $sectionData['fields'] = $this->assignImageSamples($sectionData['fields'], $createdMediaIds, $mediaByKey);
                }

                $editOf = $focusSection?->id;
                if ($editOf === null && isset($sectionData['edit_of']) && is_numeric($sectionData['edit_of'])) {
                    $candidate = AiSection::query()->find((int) $sectionData['edit_of']);
                    if ($candidate instanceof AiSection && $candidate->kind === $chat->kind && $candidate->theme_key === $chat->theme_key) {
                        $editOf = $candidate->id;
                    }
                }

                $built = $this->builder->fromAi($sectionData, $chat, $editOf);
                if (is_array($built)) {
                    Log::warning('ai.designer.invalid_output', [
                        'stage' => 'section_build',
                        'chat_id' => $chat->id,
                        'message_id' => $pending->id,
                        'errors' => $built,
                    ]);
                    $this->failMessage($pending, __('ai.designer.invalid_output'));

                    return;
                }
                $version = $built;
            }

            if ($version instanceof AiSectionVersion && $firstUsage !== null) {
                AiWalletEntry::query()
                    ->where('ai_usage_id', $firstUsage->id)
                    ->update(['description' => 'المصمم الذكي: '.$version->name]);
            }

            if ($imageFailures !== []) {
                $failureLines = implode("\n", array_values(array_unique($imageFailures)));
                $replyText = $replyText !== '' ? $replyText."\n\n".$failureLines : $failureLines;
            }

            if ($replyText === '') {
                $replyText = $version instanceof AiSectionVersion
                    ? 'صممتلك القسم، تقدر تعاينه وتعتمده.'
                    : ($directRun instanceof AiDesignRun
                        ? 'عدّلتلك التصميم، تقدر تعاينه وتعتمده دلوقتي.'
                        : (is_array($planData)
                            ? 'جهزتلك خطة التصميم الكاملة، راجعها واضغط «نفّذ الخطة».'
                            : 'جهزتلك الصور وحفظتها في مكتبة الصور.'));
            }

            $pending->forceFill([
                'text' => $replyText,
                'media_ids' => $createdMediaIds === [] ? null : $createdMediaIds,
                'version_id' => $version?->id,
                'run_id' => $directRun?->id,
                'plan' => $planData,
                'ai_usage_id' => $this->ai->lastUsage()?->id ?? $firstUsage?->id,
                'status' => 'done',
                'error' => null,
            ])->save();
        } catch (AiUnavailable|ApiException) {
            $this->failMessage($pending, __('ai.designer.unavailable'));
        } catch (Throwable $e) {
            report($e);
            $this->failMessage($pending, __('ai.designer.invalid_output'));
        }
    }

    /**
     * Approve a proposed version: creates a new AiSection or updates the edited section's current version.
     *
     * @return array{section: array<string, mixed>, version: array<string, mixed>}
     */
    public function approve(AiSectionVersion $version): array
    {
        return DB::transaction(function () use ($version): array {
            /** @var AiSectionVersion $locked */
            $locked = AiSectionVersion::query()->with('chat')->whereKey($version->id)->lockForUpdate()->firstOrFail();

            if ($locked->status !== 'proposed') {
                throw new ApiException(409, 'version_decided', __('ai.designer.version_decided'));
            }

            $editOf = $locked->ai_section_id;

            if ($editOf === null) {
                $chat = $locked->chat;
                $kind = $chat?->kind ?? 'store';
                $themeKey = $chat?->theme_key ?? 'asas_store';

                $activeCount = AiSection::query()
                    ->forTheme($kind, $themeKey)
                    ->whereNull('archived_at')
                    ->lockForUpdate()
                    ->count();

                if ($activeCount >= AiSection::MAX_PER_THEME) {
                    throw new ApiException(422, 'ai_sections_full', __('ai.designer.sections_full'));
                }

                $section = AiSection::query()->create([
                    'kind' => $kind,
                    'theme_key' => $themeKey,
                    'name' => $locked->name,
                    'current_version_id' => $locked->id,
                ]);

                $locked->forceFill([
                    'ai_section_id' => $section->id,
                    'status' => 'approved',
                    'decided_at' => now(),
                ])->save();
            } else {
                /** @var AiSection $section */
                $section = AiSection::query()->whereKey($editOf)->lockForUpdate()->firstOrFail();

                if ($section->current_version_id !== null && (int) $section->current_version_id !== $locked->id) {
                    AiSectionVersion::query()
                        ->whereKey($section->current_version_id)
                        ->update(['status' => 'replaced']);
                }

                $locked->forceFill([
                    'status' => 'approved',
                    'decided_at' => now(),
                ])->save();

                $section->forceFill([
                    'name' => $locked->name,
                    'current_version_id' => $locked->id,
                ])->save();
            }

            return [
                'section' => [
                    'id' => $section->id,
                    'name' => $section->name,
                    'current' => $locked->definition(),
                ],
                'version' => $this->formatVersion($locked),
            ];
        });
    }

    /**
     * Reject a proposed version without modifying the existing section.
     *
     * @return array<string, mixed>
     */
    public function reject(AiSectionVersion $version): array
    {
        return DB::transaction(function () use ($version): array {
            /** @var AiSectionVersion $locked */
            $locked = AiSectionVersion::query()->whereKey($version->id)->lockForUpdate()->firstOrFail();

            if ($locked->status !== 'proposed') {
                throw new ApiException(409, 'version_decided', __('ai.designer.version_decided'));
            }

            $locked->forceFill([
                'status' => 'rejected',
                'decided_at' => now(),
            ])->save();

            return $this->formatVersion($locked);
        });
    }

    /**
     * Format a chat and its messages for the dashboard API (`GET /chats/{chat}`, `POST /chat`, `POST /chat/new`).
     *
     * @return array{chat: array<string, mixed>, messages: list<array<string, mixed>>}
     */
    public function formatChat(AiChat $chat): array
    {
        $this->expireStalePending($chat);

        $messages = $chat->messages()
            ->with(['version', 'run'])
            ->orderBy('id')
            ->get();

        $allMediaIds = [];
        foreach ($messages as $m) {
            if (is_array($m->media_ids)) {
                array_push($allMediaIds, ...array_map('intval', $m->media_ids));
            }
            if ($m->version instanceof AiSectionVersion && is_array($m->version->fields)) {
                foreach ($m->version->fields as $f) {
                    if (is_array($f)) {
                        $smId = $f['sample_media_id'] ?? $f['sample'] ?? null;
                        if (is_int($smId) && $smId > 0) {
                            $allMediaIds[] = $smId;
                        }
                    }
                }
            }
        }

        $mediaById = $allMediaIds === []
            ? collect()
            : Media::query()->whereIn('id', array_values(array_unique($allMediaIds)))->get()->keyBy('id');

        return [
            'chat' => [
                'id' => $chat->id,
                'kind' => $chat->kind,
                'theme_key' => $chat->theme_key,
                'landing_page_id' => $chat->landing_page_id,
                'closed_at' => $chat->closed_at?->toIso8601ZuluString(),
            ],
            'messages' => $messages->map(function (AiChatMessage $m) use ($mediaById, $chat): array {
                $mediaItems = [];
                foreach ((array) ($m->media_ids ?? []) as $mid) {
                    $media = $mediaById->get((int) $mid);
                    if ($media instanceof Media) {
                        $urls = $media->urls();
                        $mediaItems[] = [
                            'id' => $media->id,
                            'url' => $urls['thumb'] ?? $urls['medium'] ?? $urls['large'] ?? '',
                            'urls' => $urls,
                        ];
                    }
                }

                return [
                    'id' => $m->id,
                    'role' => $m->role,
                    'text' => $m->text,
                    'media' => $mediaItems,
                    'status' => $m->status,
                    'error' => $m->error,
                    'focus_section_id' => $m->focus_section_id,
                    'version' => $m->version instanceof AiSectionVersion ? $this->formatVersion($m->version) : null,
                    'plan' => $m->plan,
                    'run_id' => $m->run_id,
                    'run' => $m->run instanceof AiDesignRun ? $this->runner->formatRun($m->run, $chat) : null,
                    'created_at' => $m->created_at?->toIso8601ZuluString(),
                ];
            })->values()->all(),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function formatVersion(AiSectionVersion $version): array
    {
        return [
            'id' => $version->id,
            'ai_section_id' => $version->ai_section_id,
            'name' => $version->name,
            'html' => $version->html,
            'css' => $version->css,
            'fields' => $version->fields,
            'status' => $version->status,
        ];
    }

    public function systemPrompt(): string
    {
        $prompt = (string) file_get_contents(resource_path('prompts/ai-designer.md'));

        if (! $this->stock->configured()) {
            $prompt = (string) preg_replace('/<!--\s*STOCK_START\s*-->.*?<!--\s*STOCK_END\s*-->\s*/s', '', $prompt);
            $prompt = (string) preg_replace('/<!--\s*STOCK_INLINE_START\s*-->.*?<!--\s*STOCK_INLINE_END\s*-->/s', '', $prompt);
            $prompt = str_replace('remove_bg | studio | enhance | generate | stock', 'remove_bg | studio | enhance | generate', $prompt);
        } else {
            $prompt = (string) preg_replace('/<!--\s*STOCK_(?:INLINE_)?(?:START|END)\s*-->\s*/', '', $prompt);
        }

        return $prompt;
    }

    private function validateTarget(string $kind, string $themeKey, ?int $landingPageId): ?int
    {
        if ($kind === 'store') {
            $store = Store::query()->first();
            if (! $store instanceof Store || $store->theme_key !== $themeKey) {
                throw new ApiException(422, 'wrong_theme', __('ai.sections.wrong_theme'));
            }

            return null;
        }

        if ($kind === 'landing') {
            if ($landingPageId === null) {
                throw new ApiException(422, 'wrong_theme', __('ai.sections.wrong_theme'));
            }
            $page = LandingPage::query()->landings()->find($landingPageId);
            if (! $page instanceof LandingPage || $page->theme_key !== $themeKey) {
                throw new ApiException(422, 'wrong_theme', __('ai.sections.wrong_theme'));
            }

            return $page->id;
        }

        throw new ApiException(422, 'wrong_theme', __('ai.sections.wrong_theme'));
    }

    /**
     * Validate the JSON structure and (if present) the section definition before executing any image tasks.
     *
     * @return array{
     *     reply: string,
     *     action: string,
     *     section: array<string, mixed>|null,
     *     images: list<array<string, mixed>>,
     *     plan: array<string, mixed>|null,
     *     errors: list<string>
     * }
     */
    private function validateReplyJson(string $rawText, AiChat $chat): array
    {
        $empty = ['reply' => '', 'action' => 'none', 'section' => null, 'images' => [], 'plan' => null, 'raw_text' => $rawText, 'errors' => []];

        if (strlen($rawText) > self::MAX_JSON_BYTES) {
            return [...$empty, 'errors' => ['Response JSON exceeds the 200 KB size limit.']];
        }

        $json = self::decodeJson($rawText);
        if (! is_array($json)) {
            return [...$empty, 'errors' => ['Response is not valid JSON.']];
        }

        $reply = isset($json['reply']) && is_string($json['reply']) ? trim(strip_tags($json['reply'])) : '';
        $action = isset($json['action']) && is_string($json['action']) ? trim($json['action']) : 'none';

        if (! in_array($action, ['none', 'section', 'images', 'plan', 'design'], true)) {
            return [...$empty, 'errors' => ["Unsupported action '{$action}'."]];
        }

        if ($action === 'design') {
            $hasDesignObj = is_array($json['design'] ?? null)
                || (isset($json['settings'], $json['sections']) && is_array($json['settings']) && is_array($json['sections']));
            if (! $hasDesignObj) {
                return [...$empty, 'errors' => ['Field "design" is required when action is "design".']];
            }
            $rawImages = is_array($json['images'] ?? null) ? array_values($json['images']) : [];
            $cleanImages = [];
            foreach (array_slice($rawImages, 0, self::MAX_REPLY_IMAGES) as $item) {
                if (is_array($item) && isset($item['action']) && is_string($item['action'])) {
                    $cleanImages[] = $item;
                }
            }

            return [
                'reply' => $reply !== '' ? $reply : 'عدّلتلك التصميم، تقدر تعاينه وتعتمده دلوقتي.',
                'action' => 'design',
                'section' => null,
                'images' => $cleanImages,
                'plan' => null,
                'raw_text' => $rawText,
                'errors' => [],
            ];
        }

        if ($action === 'plan') {
            if (! is_array($json['plan'] ?? null)) {
                return [...$empty, 'errors' => ['Field "plan" is required when action is "plan".']];
            }

            return [
                'reply' => $reply !== '' ? $reply : 'جهزتلك خطة التصميم الكاملة، راجعها واضغط «نفّذ الخطة».',
                'action' => 'plan',
                'section' => null,
                'images' => [],
                'plan' => $this->runner->cleanPlan($json['plan'], $chat),
                'raw_text' => $rawText,
                'errors' => [],
            ];
        }

        $rawImages = is_array($json['images'] ?? null) ? array_values($json['images']) : [];
        $cleanImages = [];
        foreach (array_slice($rawImages, 0, self::MAX_REPLY_IMAGES) as $item) {
            if (is_array($item) && isset($item['action']) && is_string($item['action'])) {
                $cleanImages[] = $item;
            }
        }

        $hasSection = is_array($json['section'] ?? null);

        if ($action === 'none' && ! $hasSection && $cleanImages === []) {
            if ($reply === '') {
                return [...$empty, 'errors' => ['Field "reply" must be a non-empty Arabic string.']];
            }

            return [
                'reply' => $reply,
                'action' => 'none',
                'section' => null,
                'images' => [],
                'plan' => null,
                'raw_text' => $rawText,
                'errors' => [],
            ];
        }

        if ($action === 'images' && $cleanImages === [] && ! $hasSection) {
            return [...$empty, 'errors' => ['Field "images" must be a non-empty array when action is "images".']];
        }

        if ($action === 'section' && ! $hasSection) {
            return [...$empty, 'errors' => ['Field "section" is required when action is "section".']];
        }

        $sectionData = $hasSection ? $json['section'] : null;

        if (is_array($sectionData)) {
            $sectionErrors = $this->validateSectionCandidate($sectionData, $chat->kind);
            if ($sectionErrors !== []) {
                return [...$empty, 'errors' => $sectionErrors];
            }
        }

        return [
            'reply' => $reply,
            'action' => $action,
            'section' => $sectionData,
            'images' => $cleanImages,
            'plan' => null,
            'raw_text' => $rawText,
            'errors' => [],
        ];
    }

    /**
     * Dry-run validation of a section array before running image tasks.
     *
     * @param  array<string, mixed>  $section
     * @return list<string>
     */
    private function validateSectionCandidate(array $section, string $kind): array
    {
        $errors = [];

        $rawHtml = isset($section['html']) && is_string($section['html']) ? $section['html'] : '';
        $rawCss = isset($section['css']) && is_string($section['css']) ? $section['css'] : '';
        $rawFields = isset($section['fields']) && is_array($section['fields']) ? $section['fields'] : [];

        if (trim($rawHtml) === '') {
            $errors[] = 'Section html is required.';
        }

        $schemaResult = AiSectionFields::schema($rawFields, $kind);
        array_push($errors, ...$schemaResult['errors']);

        if (trim($rawHtml) !== '') {
            $sanitized = AiSectionSanitizer::clean($rawHtml);
            array_push($errors, ...$sanitized['errors']);

            if ($sanitized['errors'] === []) {
                $tplErrors = AiTemplate::validate($sanitized['html'], $schemaResult['fields'], $kind);
                array_push($errors, ...$tplErrors);
            }
        }

        $cssResult = AiSectionCss::scope($rawCss, '0');
        array_push($errors, ...$cssResult['errors']);

        return array_values(array_unique($errors));
    }

    /**
     * Execute up to 6 image tasks (`remove_bg`, `studio`, `enhance`, `generate`, `stock`).
     * A failed item does not fail the others; its Arabic reason is returned in `failures`.
     *
     * @param  list<array<string, mixed>>  $imageItems
     * @return array{media_ids: list<int>, by_key: array<string, int>, failures: list<string>}
     */
    private function executeImageTasks(Tenant $tenant, ?AiChatMessage $newestUserMsg, array $imageItems): array
    {
        $userMediaIds = ($newestUserMsg instanceof AiChatMessage && is_array($newestUserMsg->media_ids))
            ? array_values(array_map('intval', $newestUserMsg->media_ids))
            : [];

        $mediaIds = [];
        $byKey = [];
        $failures = [];

        foreach (array_slice($imageItems, 0, self::MAX_REPLY_IMAGES) as $idx => $item) {
            $imgAction = trim((string) ($item['action'] ?? ''));
            $prompt = trim((string) ($item['prompt'] ?? ''));
            $use = trim((string) ($item['use'] ?? ''));
            $id = trim((string) ($item['id'] ?? 'i'.($idx + 1)));
            $uploadIdx = isset($item['upload']) && is_numeric($item['upload']) ? max(1, (int) $item['upload']) : 1;
            $fileName = $use !== '' ? $use : ($id !== '' ? $id : $imgAction);

            try {
                if (in_array($imgAction, ['remove_bg', 'studio', 'enhance'], true)) {
                    $sourceMediaId = $userMediaIds[$uploadIdx - 1] ?? $userMediaIds[0] ?? null;
                    $dataUrl = $sourceMediaId !== null ? $this->singleMediaDataUrl($sourceMediaId) : null;

                    if ($dataUrl === null) {
                        $failures[] = __('ai.designer.image_failed');

                        continue;
                    }

                    $instruction = match ($imgAction) {
                        'remove_bg' => 'Isolate the main product and remove the background completely on a clean pure white background. Keep all product details intact.',
                        'studio' => 'Place this exact product on a professional commercial studio background: '
                            .($prompt !== '' ? $prompt : 'clean minimalist studio surface with soft commercial lighting')
                            .'. Keep the product unchanged.',
                        default => 'Enhance the lighting, sharpness, color balance, and commercial studio quality of this product photo while keeping the product faithful and unchanged.',
                    };

                    $aiImage = $this->ai->imagePaid(
                        $tenant,
                        'designer',
                        'image_edit',
                        fn ($client, string $model) => $client->editImage($model, $dataUrl, $instruction),
                        'المصمم الذكي: تعديل صورة',
                    );

                    $saved = $this->images->store($tenant, $aiImage, $fileName);
                } elseif ($imgAction === 'generate') {
                    if ($prompt === '') {
                        $failures[] = __('ai.designer.image_failed');

                        continue;
                    }

                    $aspect = (str_contains(strtolower($use), 'banner') || str_contains(strtolower($use), 'hero'))
                        ? '16:9'
                        : '1:1';
                    $safePrompt = $prompt.'. Strictly photographic, no text, no letters, no numbers, no logos, no brand names.';

                    $aiImage = $this->ai->imagePaid(
                        $tenant,
                        'designer',
                        'image_generate',
                        fn ($client, string $model) => $client->generateImage($model, $safePrompt, $aspect),
                        'المصمم الذكي: توليد صورة',
                    );

                    $saved = $this->images->store($tenant, $aiImage, $fileName);
                } elseif ($imgAction === 'stock') {
                    if (! $this->stock->configured() || $prompt === '') {
                        $failures[] = __('ai.designer.image_failed');

                        continue;
                    }

                    $orientation = str_contains(strtolower($use), 'portrait') ? 'portrait' : 'landscape';
                    $photos = $this->stock->search($prompt, 1, $orientation);
                    if ($photos === []) {
                        $failures[] = __('ai.designer.image_failed');

                        continue;
                    }

                    $photo = $photos[0];
                    $saved = $this->images->store($tenant, $photo->toAiImage(), $fileName, $photo->credit());
                } else {
                    $failures[] = __('ai.designer.image_failed');

                    continue;
                }

                $mediaIds[] = $saved->id;
                if ($id !== '') {
                    $byKey[$id] = $saved->id;
                }
                if ($use !== '') {
                    $byKey[$use] = $saved->id;
                }
            } catch (ApiException $e) {
                $failures[] = $e->getMessage();
            } catch (AiUnavailable) {
                $failures[] = __('ai.designer.image_failed');
            } catch (Throwable $e) {
                report($e);
                $failures[] = __('ai.designer.image_failed');
            }
        }

        return [
            'media_ids' => $mediaIds,
            'by_key' => $byKey,
            'failures' => $failures,
        ];
    }

    /**
     * Link newly generated media IDs as `sample` / `sample_media_id` on the section's `image` fields.
     *
     * @param  array<int, mixed>  $fields
     * @param  list<int>  $mediaIds
     * @param  array<string, int>  $byKey
     * @return array<int, mixed>
     */
    private function assignImageSamples(array $fields, array $mediaIds, array $byKey): array
    {
        $used = [];

        // Pass 1: exact match by field key or sample reference
        foreach ($fields as $i => $field) {
            if (! is_array($field) || ($field['type'] ?? null) !== 'image') {
                continue;
            }
            $key = isset($field['key']) && is_string($field['key']) ? trim($field['key']) : '';
            $sampleRef = isset($field['sample']) && is_string($field['sample']) ? trim($field['sample']) : '';

            $matchedId = $byKey[$key] ?? ($sampleRef !== '' ? ($byKey[$sampleRef] ?? null) : null);
            if ($matchedId !== null) {
                $fields[$i]['sample'] = $matchedId;
                $fields[$i]['sample_media_id'] = $matchedId;
                $used[$matchedId] = true;
            }
        }

        // Pass 2: assign remaining generated images in order to any `image` field without a sample_media_id
        $remaining = array_values(array_filter($mediaIds, fn (int $id): bool => ! isset($used[$id])));
        $remIdx = 0;

        foreach ($fields as $i => $field) {
            if (! is_array($field) || ($field['type'] ?? null) !== 'image') {
                continue;
            }
            if (isset($field['sample_media_id']) && is_int($field['sample_media_id'])) {
                continue;
            }
            $fallbackId = $remaining[$remIdx] ?? $mediaIds[0] ?? null;
            if ($fallbackId !== null) {
                $fields[$i]['sample'] = $fallbackId;
                $fields[$i]['sample_media_id'] = $fallbackId;
                $remIdx++;
            }
        }

        return $fields;
    }

    /**
     * Build the prompt messages array (§3.9): system prompt + context block + last 12 chat messages.
     *
     * @return list<array{role: 'system'|'user'|'assistant', content: string|list<array<string, string>>}>
     */
    private function buildPromptMessages(
        Tenant $tenant,
        AiChat $chat,
        AiChatMessage $pending,
        ?AiSection $focusSection,
    ): array {
        $messages = [
            ['role' => 'system', 'content' => $this->systemPrompt()."\n\n".$this->contextBlock($tenant, $chat, $focusSection)],
        ];

        $history = AiChatMessage::query()
            ->with('version')
            ->where('chat_id', $chat->id)
            ->where('id', '<', $pending->id)
            ->where('status', 'done')
            ->orderByDesc('id')
            ->limit(self::HISTORY_LIMIT)
            ->get()
            ->reverse()
            ->values();

        $newestUserId = $history->where('role', 'user')->max('id');

        foreach ($history as $msg) {
            $text = trim((string) $msg->text);

            if ($msg->role === 'user') {
                $imageUrls = ((int) $msg->id === (int) $newestUserId) ? $this->messageImageDataUrls($msg) : [];
                $content = null;
                if ($imageUrls !== []) {
                    $parts = [['type' => 'text', 'text' => $text !== '' ? $text : '(صورة مرجعية)']];
                    foreach ($imageUrls as $dataUrl) {
                        $parts[] = ['type' => 'image', 'url' => $dataUrl];
                    }
                    $content = $parts;
                } elseif ($text !== '') {
                    $content = $text;
                }

                if ($content !== null) {
                    $last = $messages[array_key_last($messages)];
                    // Collapse identical consecutive user retries (when failed assistant reply was skipped)
                    if (($last['role'] ?? null) === 'user' && $last['content'] === $content) {
                        continue;
                    }
                    $messages[] = ['role' => 'user', 'content' => $content];
                }
            } else {
                $assistantText = $text;
                if ($msg->version instanceof AiSectionVersion) {
                    $assistantText .= "\n[Proposed section: {$msg->version->name}]";
                }
                if (is_array($msg->plan)) {
                    $planState = $msg->run_id === null
                        ? 'Proposed plan (NOT executed yet — if the merchant asks to adjust sections/style/scope, return updated action: "plan")'
                        : "Proposed plan (run #{$msg->run_id} already started)";
                    $assistantText .= "\n[{$planState}: ".json_encode($msg->plan, JSON_UNESCAPED_UNICODE).']';
                }
                if ($assistantText !== '') {
                    $messages[] = ['role' => 'assistant', 'content' => $assistantText];
                }
            }
        }

        return $messages;
    }

    private function contextBlock(Tenant $tenant, AiChat $chat, ?AiSection $focusSection): string
    {
        $lines = [
            '## CURRENT CONTEXT',
            "Kind: {$chat->kind}",
            "Theme: {$chat->theme_key}",
            "Store name: {$tenant->name}",
            'Dark mode supported: '.(in_array($chat->theme_key, ['sufi_store', 'sufi_landing'], true) ? 'yes' : 'no'),
        ];

        if ($chat->kind === 'store') {
            $design = StoreDesign::query()->where('theme_key', $chat->theme_key)->first();
            $settings = is_array($design?->draft['settings'] ?? null) ? $design->draft['settings'] : [];
            $colors = is_array($settings['colors'] ?? null) ? $settings['colors'] : [];
            $font = is_string($settings['font'] ?? null) ? $settings['font'] : 'cairo';
            $lines[] = 'Theme colors: '.json_encode($colors, JSON_UNESCAPED_UNICODE);
            $lines[] = "Theme font: {$font}";
        } elseif ($chat->landing_page_id !== null) {
            $page = LandingPage::query()->with('product')->find($chat->landing_page_id);
            if ($page instanceof LandingPage) {
                $settings = is_array($page->draft_content['settings'] ?? null) ? $page->draft_content['settings'] : [];
                $colors = is_array($settings['colors'] ?? null) ? $settings['colors'] : [];
                $font = is_string($settings['font'] ?? null) ? $settings['font'] : 'cairo';
                $lines[] = 'Theme colors: '.json_encode($colors, JSON_UNESCAPED_UNICODE);
                $lines[] = "Theme font: {$font}";
                if ($page->product !== null) {
                    $lines[] = "Landing page product: {$page->product->name}";
                }
            }
        }

        if ($focusSection !== null && $focusSection->current !== null) {
            $ver = $focusSection->current;
            $lines[] = '';
            $lines[] = '## FOCUSED SECTION TO EDIT';
            $lines[] = "Focused section ID: {$focusSection->id}";
            $lines[] = "Focused section name: {$focusSection->name}";
            $lines[] = 'Current fields JSON: '.json_encode($ver->fields, JSON_UNESCAPED_UNICODE);
            $lines[] = "Current HTML:\n".$ver->html;
            $lines[] = "Current CSS:\n".$ver->css_raw;
        } else {
            $lines[] = '';
            $lines[] = '## CURRENT DRAFT JSON';
            $lines[] = json_encode($this->runner->currentDraft($chat), JSON_UNESCAPED_UNICODE);

            $lines[] = '';
            $lines[] = '## THEME SPECIFICATION';
            $lines[] = $this->runner->themeDocument($chat->theme_key);
        }

        return implode("\n", $lines);
    }

    /**
     * @return list<string>
     */
    private function messageImageDataUrls(AiChatMessage $message): array
    {
        $ids = is_array($message->media_ids) ? array_slice(array_map('intval', $message->media_ids), 0, AiChatMessage::MAX_IMAGES) : [];
        if ($ids === []) {
            return [];
        }

        $urls = [];
        foreach ($ids as $id) {
            $url = $this->singleMediaDataUrl($id);
            if ($url !== null) {
                $urls[] = $url;
            }
        }

        return $urls;
    }

    private function singleMediaDataUrl(int $mediaId): ?string
    {
        $media = Media::query()->find($mediaId);
        if (! $media instanceof Media) {
            return null;
        }

        $relPath = $media->variants['medium'] ?? $media->path;
        $disk = Storage::disk($media->disk);
        if ($disk->exists($relPath)) {
            $bytes = (string) $disk->get($relPath);
            if ($bytes !== '' && strlen($bytes) <= self::IMAGE_MAX_BYTES) {
                $mime = $media->mime !== '' ? $media->mime : 'image/webp';

                return "data:{$mime};base64,".base64_encode($bytes);
            }
        }

        if (config('ai.driver') === 'fake') {
            return self::FAKE_DATA_URL;
        }

        return null;
    }

    private function failMessage(AiChatMessage $pending, string $error): void
    {
        $pending->forceFill([
            'status' => 'failed',
            'error' => mb_substr($error, 0, 300, 'UTF-8'),
        ])->save();
    }

    /**
     * Decode an LLM JSON response, tolerating markdown code fences or stray leading/trailing prose.
     *
     * @return array<string, mixed>|null
     */
    public static function decodeJson(string $text): ?array
    {
        $stripped = trim((string) preg_replace('/^```(?:json)?\s*|\s*```$/u', '', trim($text)));
        $decoded = json_decode($stripped, true);
        if (is_array($decoded)) {
            return self::unwrapList($decoded);
        }

        $start = strpos($stripped, '{');
        $end = strrpos($stripped, '}');
        if ($start !== false && $end !== false && $end > $start) {
            $candidate = json_decode(substr($stripped, $start, $end - $start + 1), true);
            if (is_array($candidate)) {
                return self::unwrapList($candidate);
            }
        }

        return null;
    }

    /**
     * Some models wrap the object in a list («[ {...} ]»): take the first object of it.
     *
     * @param  array<mixed>  $decoded
     * @return array<string, mixed>|null
     */
    private static function unwrapList(array $decoded): ?array
    {
        if ($decoded !== [] && array_is_list($decoded)) {
            foreach ($decoded as $item) {
                if (is_array($item) && ! array_is_list($item)) {
                    return $item;
                }
            }

            return null;
        }

        return $decoded;
    }
}
