<?php

declare(strict_types=1);

namespace App\Ai\Designer;

use App\Ai\Ai;
use App\Ai\AiUnavailable;
use App\Ai\AiWallets;
use App\Exceptions\ApiException;
use App\Jobs\DesignerReply;
use App\Models\AiChat;
use App\Models\AiChatMessage;
use App\Models\AiSection;
use App\Models\AiSectionVersion;
use App\Models\AiWalletEntry;
use App\Models\LandingPage;
use App\Models\Media;
use App\Models\Store;
use App\Models\StoreDesign;
use App\Models\Tenant;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;
use Throwable;

/**
 * Core service for «المصمم الذكي» (docs/plans/ai-designer.md §2.4): manages chats, message queuing,
 * AI replies with automatic 1-turn repair, and version approval/rejection.
 */
final class AiDesigner
{
    public const MAX_OUTPUT_TOKENS = 12000;

    public const MAX_JSON_BYTES = 200000;

    private const HISTORY_LIMIT = 12;

    private const IMAGE_MAX_BYTES = 5_000_000;

    private const FAKE_DATA_URL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

    public function __construct(
        private readonly Ai $ai,
        private readonly AiWallets $wallets,
        private readonly AiSectionBuilder $builder,
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
                'created_at' => now(),
            ]);

            $assistant = AiChatMessage::query()->create([
                'chat_id' => $chat->id,
                'role' => 'assistant',
                'focus_section_id' => $focusSectionId,
                'status' => 'pending',
                'created_at' => now(),
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
            $parsed = $this->parseAndBuild($reply->text, $chat, $focusSection?->id);

            // One repair turn when JSON or section validation fails
            if ($parsed['errors'] !== []) {
                $repairMessages = [
                    ...$messages,
                    ['role' => 'assistant', 'content' => mb_substr($reply->text, 0, 40000, 'UTF-8')],
                    [
                        'role' => 'user',
                        'content' => "Your JSON broke these rules:\n- ".implode("\n- ", $parsed['errors'])."\nReturn the corrected full JSON only.",
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

                $parsed = $this->parseAndBuild($repairReply->text, $chat, $focusSection?->id);
            }

            if ($parsed['errors'] !== []) {
                $this->failMessage($pending, __('ai.designer.invalid_output'));

                return;
            }

            $version = $parsed['version'];
            if ($version instanceof AiSectionVersion && $firstUsage !== null) {
                AiWalletEntry::query()
                    ->where('ai_usage_id', $firstUsage->id)
                    ->update(['description' => 'المصمم الذكي: '.$version->name]);
            }

            $pending->forceFill([
                'text' => $parsed['reply'],
                'version_id' => $version?->id,
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
            ->with('version')
            ->orderBy('id')
            ->get();

        $allMediaIds = [];
        foreach ($messages as $m) {
            if (is_array($m->media_ids)) {
                array_push($allMediaIds, ...array_map('intval', $m->media_ids));
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
            'messages' => $messages->map(function (AiChatMessage $m) use ($mediaById): array {
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
     * @return array{reply: string, version: AiSectionVersion|null, errors: list<string>}
     */
    private function parseAndBuild(string $rawText, AiChat $chat, ?int $focusedId): array
    {
        if (strlen($rawText) > self::MAX_JSON_BYTES) {
            return ['reply' => '', 'version' => null, 'errors' => ['Response JSON exceeds the 200 KB size limit.']];
        }

        $json = json_decode(self::unfence($rawText), true);
        if (! is_array($json)) {
            return ['reply' => '', 'version' => null, 'errors' => ['Response is not valid JSON.']];
        }

        $reply = isset($json['reply']) && is_string($json['reply']) ? trim(strip_tags($json['reply'])) : '';
        $action = isset($json['action']) && is_string($json['action']) ? trim($json['action']) : 'none';

        if (! in_array($action, ['none', 'section'], true)) {
            return ['reply' => '', 'version' => null, 'errors' => ["Unsupported action '{$action}'."]];
        }

        if ($action === 'none') {
            if ($reply === '') {
                return ['reply' => '', 'version' => null, 'errors' => ['Field "reply" must be a non-empty Arabic string.']];
            }

            return ['reply' => $reply, 'version' => null, 'errors' => []];
        }

        $sectionData = $json['section'] ?? null;
        if (! is_array($sectionData)) {
            return ['reply' => '', 'version' => null, 'errors' => ['Field "section" is required when action is "section".']];
        }

        $editOf = $focusedId;
        if ($editOf === null && isset($sectionData['edit_of']) && is_numeric($sectionData['edit_of'])) {
            $candidate = AiSection::query()->find((int) $sectionData['edit_of']);
            if ($candidate instanceof AiSection && $candidate->kind === $chat->kind && $candidate->theme_key === $chat->theme_key) {
                $editOf = $candidate->id;
            }
        }

        $built = $this->builder->fromAi($sectionData, $chat, $editOf);
        if (is_array($built)) {
            return ['reply' => '', 'version' => null, 'errors' => $built];
        }

        return [
            'reply' => $reply !== '' ? $reply : 'صممتلك القسم، تقدر تعاينه وتعتمده.',
            'version' => $built,
            'errors' => [],
        ];
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
                if ($imageUrls !== []) {
                    $parts = [['type' => 'text', 'text' => $text !== '' ? $text : '(صورة مرجعية)']];
                    foreach ($imageUrls as $dataUrl) {
                        $parts[] = ['type' => 'image', 'url' => $dataUrl];
                    }
                    $messages[] = ['role' => 'user', 'content' => $parts];
                } elseif ($text !== '') {
                    $messages[] = ['role' => 'user', 'content' => $text];
                }
            } else {
                $assistantText = $text;
                if ($msg->version instanceof AiSectionVersion) {
                    $assistantText .= "\n[Proposed section: {$msg->version->name}]";
                }
                if ($assistantText !== '') {
                    $messages[] = ['role' => 'assistant', 'content' => $assistantText];
                }
            }
        }

        return $messages;
    }

    private function systemPrompt(): string
    {
        return (string) file_get_contents(resource_path('prompts/ai-designer.md'));
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

        $mediaItems = Media::query()->whereIn('id', $ids)->get()->keyBy('id');
        $urls = [];

        foreach ($ids as $id) {
            $media = $mediaItems->get($id);
            if (! $media instanceof Media) {
                continue;
            }
            $relPath = $media->variants['medium'] ?? $media->path;
            $disk = Storage::disk($media->disk);
            if ($disk->exists($relPath)) {
                $bytes = (string) $disk->get($relPath);
                if ($bytes !== '' && strlen($bytes) <= self::IMAGE_MAX_BYTES) {
                    $mime = $media->mime !== '' ? $media->mime : 'image/webp';
                    $urls[] = "data:{$mime};base64,".base64_encode($bytes);

                    continue;
                }
            }
            if (config('ai.driver') === 'fake') {
                $urls[] = self::FAKE_DATA_URL;
            }
        }

        return $urls;
    }

    private function failMessage(AiChatMessage $pending, string $error): void
    {
        $pending->forceFill([
            'status' => 'failed',
            'error' => mb_substr($error, 0, 300, 'UTF-8'),
        ])->save();
    }

    private static function unfence(string $text): string
    {
        $text = trim($text);

        return (string) preg_replace('/^```(?:json)?\s*|\s*```$/u', '', $text);
    }
}
