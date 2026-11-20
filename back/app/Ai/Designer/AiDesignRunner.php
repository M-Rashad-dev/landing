<?php

declare(strict_types=1);

namespace App\Ai\Designer;

use App\Actions\Pages\SavePageContent;
use App\Ai\Ai;
use App\Ai\AiCost;
use App\Ai\AiUnavailable;
use App\Ai\AiWallets;
use App\Ai\Images\StockPhotos;
use App\Ai\MediaDataUrl;
use App\Exceptions\ApiException;
use App\Jobs\RunDesign;
use App\Models\AiChat;
use App\Models\AiChatMessage;
use App\Models\AiDesignRun;
use App\Models\AiSection;
use App\Models\LandingPage;
use App\Models\Store;
use App\Models\Tenant;
use App\Pricing\Shipping;
use App\Services\PublicPageData;
use App\Store\Accounts\ProductReviews;
use App\Themes\Landing\LandingThemes;
use App\Themes\Store\StoreDesigner;
use App\Themes\Store\StoreThemes;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;
use Throwable;

/**
 * Orchestrates whole-page / whole-store AI design plans and runs (docs/plans/ai-designer.md §4.4–4.6).
 */
final class AiDesignRunner
{
    public function __construct(
        private readonly Ai $ai,
        private readonly AiWallets $wallets,
        private readonly AiSectionBuilder $sectionBuilder,
        private readonly AiImages $images,
        private readonly StockPhotos $stock,
        private readonly StoreThemes $storeThemes,
        private readonly LandingThemes $landingThemes,
        private readonly StoreDesigner $storeDesigner,
        private readonly SavePageContent $savePageContent,
        private readonly PublicPageData $pageData,
        private readonly Shipping $shipping,
    ) {}

    /**
     * Clean and normalize a proposed `plan` returned by the AI (§4.4):
     * drops unknown section types / fonts with a note.
     *
     * @param  array<string, mixed>  $rawPlan
     * @return array<string, mixed>
     */
    public function cleanPlan(array $rawPlan, AiChat $chat): array
    {
        $notes = [];
        if (isset($rawPlan['notes']) && is_string($rawPlan['notes']) && trim($rawPlan['notes']) !== '') {
            $notes[] = mb_substr(trim(strip_tags($rawPlan['notes'])), 0, 300, 'UTF-8');
        }

        $summary = isset($rawPlan['summary']) && is_string($rawPlan['summary'])
            ? mb_substr(trim(strip_tags($rawPlan['summary'])), 0, 400, 'UTF-8')
            : 'خطة تصميم متكاملة للصفحة';

        $allowedFonts = (array) config('landing.fonts', ['cairo', 'tajawal', 'almarai', 'ibm_plex_arabic', 'noto_kufi', 'readex_pro']);
        $defaultFont = in_array($chat->theme_key, ['sufi_store', 'sufi_landing'], true) ? 'almarai' : 'cairo';

        $rawStyle = is_array($rawPlan['style'] ?? null) ? $rawPlan['style'] : [];
        $rawColors = is_array($rawStyle['colors'] ?? null) ? $rawStyle['colors'] : [];
        $defaultColors = $this->defaultThemeColors($chat);

        $colors = [];
        foreach (['primary', 'secondary', 'background', 'text'] as $ck) {
            $val = $rawColors[$ck] ?? null;
            $colors[$ck] = (is_string($val) && preg_match('/^#[0-9a-fA-F]{6}$/', trim($val)))
                ? strtolower(trim($val))
                : $defaultColors[$ck];
        }

        $font = isset($rawStyle['font']) && is_string($rawStyle['font']) ? strtolower(trim($rawStyle['font'])) : $defaultFont;
        if (! in_array($font, $allowedFonts, true)) {
            $notes[] = "تم استبدال الخط غير المدعوم ({$font}) بالخط الافتراضي ({$defaultFont}).";
            $font = $defaultFont;
        }

        $mood = isset($rawStyle['mood']) && is_string($rawStyle['mood']) && trim($rawStyle['mood']) !== ''
            ? mb_substr(trim(strip_tags($rawStyle['mood'])), 0, 120, 'UTF-8')
            : 'عصري ومريح للعين';

        $supportsDark = in_array($chat->theme_key, ['sufi_store', 'sufi_landing'], true);
        $dark = $supportsDark && (bool) ($rawStyle['dark'] ?? false);

        $allowedTypes = $this->allowedSectionTypes($chat);
        $maxSections = $this->maxSections($chat);
        $rawSections = is_array($rawPlan['sections'] ?? null) ? array_values($rawPlan['sections']) : [];

        $cleanedSections = [];
        $customIndex = 1;
        $droppedTypes = [];

        foreach ($rawSections as $sec) {
            if (count($cleanedSections) >= $maxSections) {
                break;
            }
            if (! is_array($sec) || ! isset($sec['type']) || ! is_string($sec['type'])) {
                continue;
            }
            $type = trim($sec['type']);
            $title = isset($sec['title']) && is_string($sec['title']) && trim($sec['title']) !== ''
                ? mb_substr(trim(strip_tags($sec['title'])), 0, 80, 'UTF-8')
                : $type;

            if ($type === 'custom') {
                $key = isset($sec['key']) && is_string($sec['key']) && preg_match('/^[a-z0-9_]{1,20}$/i', trim($sec['key']))
                    ? strtolower(trim($sec['key']))
                    : 'c'.$customIndex;
                $customIndex++;
                $request = isset($sec['request']) && is_string($sec['request']) && trim($sec['request']) !== ''
                    ? mb_substr(trim(strip_tags($sec['request'])), 0, 600, 'UTF-8')
                    : $title;

                $cleanedSections[] = [
                    'type' => 'custom',
                    'key' => $key,
                    'title' => $title,
                    'request' => $request,
                    'enabled' => isset($sec['enabled']) ? (bool) $sec['enabled'] : true,
                ];
            } elseif (in_array($type, $allowedTypes, true)) {
                $purpose = isset($sec['purpose']) && is_string($sec['purpose'])
                    ? mb_substr(trim(strip_tags($sec['purpose'])), 0, 200, 'UTF-8')
                    : '';
                $cleanedSections[] = [
                    'type' => $type,
                    'title' => $title,
                    'purpose' => $purpose,
                ];
            } else {
                $droppedTypes[] = $type;
            }
        }

        if ($droppedTypes !== []) {
            $notes[] = 'تم استبعاد أقسام غير مدعومة في الثيم: '.implode('، ', array_unique($droppedTypes)).'.';
        }

        if ($chat->kind === 'landing') {
            $hasOrderForm = collect($cleanedSections)->contains(fn (array $s): bool => ($s['type'] ?? '') === 'order_form');
            if (! $hasOrderForm) {
                $cleanedSections[] = [
                    'type' => 'order_form',
                    'title' => 'نموذج الطلب',
                    'purpose' => 'تسجيل بيانات العميل وإتمام الطلب',
                ];
            }
        }

        $rawImages = is_array($rawPlan['images'] ?? null) ? array_values($rawPlan['images']) : [];
        $cleanedImages = [];
        foreach (array_slice($rawImages, 0, AiDesigner::MAX_REPLY_IMAGES) as $idx => $img) {
            if (! is_array($img) || ! isset($img['action']) || ! is_string($img['action'])) {
                continue;
            }
            $act = trim($img['action']);
            if ($act === 'stock' && ! $this->stock->configured()) {
                $act = 'generate';
            }
            if (! in_array($act, ['remove_bg', 'studio', 'enhance', 'generate', 'stock'], true)) {
                continue;
            }
            $id = isset($img['id']) && is_string($img['id']) && trim($img['id']) !== ''
                ? trim($img['id'])
                : 'i'.($idx + 1);
            $cleanedImages[] = [
                'id' => $id,
                'action' => $act,
                'upload' => isset($img['upload']) && is_numeric($img['upload']) ? max(1, (int) $img['upload']) : 1,
                'prompt' => isset($img['prompt']) && is_string($img['prompt']) ? mb_substr(trim($img['prompt']), 0, 400, 'UTF-8') : '',
                'use' => isset($img['use']) && is_string($img['use']) ? mb_substr(trim(strip_tags($img['use'])), 0, 120, 'UTF-8') : $id,
            ];
        }

        return [
            'summary' => $summary,
            'style' => [
                'colors' => $colors,
                'font' => $font,
                'mood' => $mood,
                'dark' => $dark,
            ],
            'sections' => $cleanedSections,
            'images' => $cleanedImages,
            'notes' => implode(' ', $notes),
        ];
    }

    /**
     * Start a design run from a plan message (`POST /messages/{message}/run`).
     *
     * @param  array<string, mixed>  $customSwitches
     */
    public function startFromPlan(Tenant $tenant, AiChatMessage $message, array $customSwitches = []): AiDesignRun
    {
        $message->loadMissing('chat');
        $chat = $message->chat;
        if (! $chat instanceof AiChat || $message->role !== 'assistant' || ! is_array($message->plan) || $message->plan === []) {
            throw new ApiException(422, 'invalid_plan', __('ai.designer.invalid_output'));
        }

        if ($this->ai->blocker('designer') !== null) {
            throw new ApiException(422, 'ai_unavailable', __('ai.wallet.unavailable'));
        }

        return DB::transaction(function () use ($tenant, $chat, $message, $customSwitches): AiDesignRun {
            $hasActive = AiDesignRun::query()
                ->where('chat_id', $chat->id)
                ->whereIn('status', AiDesignRun::ACTIVE_STATUSES)
                ->lockForUpdate()
                ->exists();

            if ($hasActive) {
                throw new ApiException(422, 'run_in_progress', __('ai.designer.run_in_progress'));
            }

            $plan = $message->plan;
            $sections = is_array($plan['sections'] ?? null) ? $plan['sections'] : [];
            $enabledCustomCount = 0;

            foreach ($sections as $i => $sec) {
                if (is_array($sec) && ($sec['type'] ?? '') === 'custom') {
                    $key = (string) ($sec['key'] ?? '');
                    $enabled = array_key_exists($key, $customSwitches)
                        ? (bool) $customSwitches[$key]
                        : (bool) ($sec['enabled'] ?? true);
                    $sections[$i]['enabled'] = $enabled;
                    if ($enabled) {
                        $enabledCustomCount++;
                    }
                }
            }
            $plan['sections'] = $sections;

            // Up-front balance check: design call + custom section calls + image prices
            $designerModel = Ai::model('designer');
            $estimatedUsd = Ai::estimate(
                $designerModel,
                [['role' => 'user', 'content' => $this->themeDocument($chat->theme_key)]],
                AiDesigner::MAX_OUTPUT_TOKENS,
            );

            if ($enabledCustomCount > 0) {
                $estimatedUsd += $enabledCustomCount * Ai::estimate(
                    $designerModel,
                    [['role' => 'user', 'content' => 'custom section']],
                    AiDesigner::MAX_OUTPUT_TOKENS,
                );
            }

            foreach ((array) ($plan['images'] ?? []) as $imgTask) {
                if (! is_array($imgTask)) {
                    continue;
                }
                $act = (string) ($imgTask['action'] ?? '');
                if ($act === 'generate') {
                    $estimatedUsd += AiCost::imagePrice(Ai::model('image_generate'));
                } elseif (in_array($act, ['remove_bg', 'studio', 'enhance'], true)) {
                    $estimatedUsd += AiCost::imagePrice(Ai::model('image_edit'));
                }
            }

            $this->wallets->ensureCanSpend($tenant, $estimatedUsd);

            $run = AiDesignRun::query()->create([
                'chat_id' => $chat->id,
                'plan' => $plan,
                'status' => 'queued',
                'progress' => 'في الانتظار…',
            ]);

            $message->forceFill([
                'plan' => $plan,
                'run_id' => $run->id,
            ])->save();

            RunDesign::dispatch($tenant->id, $run->id)->afterCommit();

            return $run;
        });
    }

    /**
     * Execute the steps of a queued `AiDesignRun` (called by `RunDesign` job).
     * Never throws out of the job.
     */
    public function execute(AiDesignRun $run): void
    {
        if (! in_array($run->status, AiDesignRun::ACTIVE_STATUSES, true)) {
            return;
        }

        try {
            $run->loadMissing('chat');
            $chat = $run->chat;
            $tenant = Tenant::query()->find($run->tenant_id);
            if (! $chat instanceof AiChat || ! $tenant instanceof Tenant) {
                $this->failRun($run, __('ai.designer.unavailable'));

                return;
            }

            $plan = is_array($run->plan) ? $run->plan : [];
            $chatUploadIds = $this->chatUploadedMediaIds($chat);

            // Step 1: Images
            $imageTasks = is_array($plan['images'] ?? null) ? array_values($plan['images']) : [];
            $imageResults = is_array($run->image_results) ? $run->image_results : [];

            if ($imageTasks !== []) {
                $totalImages = count($imageTasks);
                foreach ($imageTasks as $idx => $task) {
                    if (! is_array($task)) {
                        continue;
                    }
                    $taskId = (string) ($task['id'] ?? 'i'.($idx + 1));
                    $run->forceFill([
                        'status' => 'images',
                        'progress' => 'بجهز الصور ('.($idx + 1).' من '.$totalImages.')…',
                    ])->save();

                    $imageResults[$taskId] = $this->runSingleImageTask($tenant, $task, $chatUploadIds);
                }

                $run->forceFill(['image_results' => $imageResults])->save();
            }

            // Step 2: Custom AI sections
            $sections = is_array($plan['sections'] ?? null) ? $plan['sections'] : [];
            $sectionIds = is_array($run->section_ids) ? $run->section_ids : [];

            foreach ($sections as $sec) {
                if (! is_array($sec) || ($sec['type'] ?? '') !== 'custom' || ($sec['enabled'] ?? true) !== true) {
                    continue;
                }
                $key = (string) ($sec['key'] ?? 'c1');
                $title = (string) ($sec['title'] ?? 'قسم خاص');
                $requestText = (string) ($sec['request'] ?? $title);

                $run->forceFill([
                    'status' => 'sections',
                    'progress' => 'بعمل القسم الخاص: '.$title.'…',
                ])->save();

                $secId = $this->buildAndApproveCustomSection($tenant, $chat, $title, $requestText);
                if ($secId !== null) {
                    $sectionIds[$key] = $secId;
                }
            }

            if ($sectionIds !== []) {
                $run->forceFill(['section_ids' => $sectionIds])->save();
            }

            // Step 3: Whole design generation
            $run->forceFill([
                'status' => 'design',
                'progress' => 'بجهز التصميم…',
            ])->save();

            $currentDraft = $this->currentDraft($chat);
            $designMessages = $this->buildDesignPromptMessages(
                $tenant,
                $chat,
                $currentDraft,
                $plan,
                $imageResults,
                $sectionIds,
                count($chatUploadIds),
            );

            $reply = $this->ai->chatPaid(
                $tenant,
                'designer',
                'designer',
                $designMessages,
                ['max_tokens' => AiDesigner::MAX_OUTPUT_TOKENS, 'json' => true],
                'المصمم الذكي: تصميم كامل',
            );

            $attempt = $this->parseReplaceAndValidate(
                $reply->text,
                $chat,
                $currentDraft,
                $chatUploadIds,
                $imageResults,
            );

            // Step 6: One repair call on validation or placeholder errors
            if ($attempt['errors'] !== []) {
                $repairMessages = [
                    ...$designMessages,
                    ['role' => 'assistant', 'content' => mb_substr($reply->text, 0, 40000, 'UTF-8')],
                    [
                        'role' => 'user',
                        'content' => "[MKSAB_RUN_DESIGN]\nYour design JSON broke these validation rules:\n- "
                            .implode("\n- ", $attempt['errors'])
                            ."\nReturn the corrected full JSON (`{\"reply\": \"...\", \"action\": \"design\", \"design\": {...}}`) only.",
                    ],
                ];

                $repairReply = $this->ai->chatPaid(
                    $tenant,
                    'designer',
                    'designer',
                    $repairMessages,
                    ['max_tokens' => AiDesigner::MAX_OUTPUT_TOKENS, 'json' => true],
                    'المصمم الذكي: إصلاح تصميم',
                );

                $attempt = $this->parseReplaceAndValidate(
                    $repairReply->text,
                    $chat,
                    $currentDraft,
                    $chatUploadIds,
                    $imageResults,
                );
            }

            if ($attempt['errors'] !== [] || ! is_array($attempt['design'])) {
                Log::warning('ai.design_runner.invalid_output', [
                    'run_id' => $run->id,
                    'chat_id' => $chat->id,
                    'errors' => $attempt['errors'],
                ]);
                $this->failRun($run, __('ai.designer.invalid_output'));

                return;
            }

            $run->forceFill([
                'proposal' => $attempt['design'],
                'status' => 'proposed',
                'progress' => 'التصميم جاهز للمعاينة',
                'error' => null,
            ])->save();
        } catch (AiUnavailable|ApiException) {
            $this->failRun($run, __('ai.designer.unavailable'));
        } catch (Throwable $e) {
            report($e);
            $this->failRun($run, __('ai.designer.invalid_output'));
        }
    }

    /**
     * Apply a proposed run to the store design or landing page (`POST /runs/{run}/apply`).
     *
     * @return array<string, mixed>
     */
    public function apply(AiDesignRun $run, int $version): array
    {
        $run->loadMissing('chat');
        $chat = $run->chat;
        if (! $chat instanceof AiChat || $run->status !== 'proposed' || ! is_array($run->proposal)) {
            throw new ApiException(409, 'run_not_proposed', __('ai.designer.run_not_proposed'));
        }

        $previousDraft = $this->currentDraft($chat);

        try {
            if ($chat->kind === 'store') {
                $store = Store::query()->firstOrFail();
                $design = $this->storeDesigner->for($store);
                $saved = $this->storeDesigner->save($design, $run->proposal, $version);
                $newVersion = $saved->version;
            } else {
                $page = LandingPage::query()->landings()->findOrFail($chat->landing_page_id);
                $saved = $this->savePageContent->handle($page, $version, $run->proposal, null);
                $newVersion = $saved->version;
            }
        } catch (ApiException $e) {
            if ($e->status === 409) {
                throw new ApiException(409, 'design_changed', __('ai.designer.design_changed'));
            }

            throw $e;
        }

        $run->forceFill([
            'previous_draft' => $previousDraft,
            'status' => 'applied',
            'applied_at' => now(),
        ])->save();

        return [
            'run' => $this->formatRun($run, $chat),
            'version' => $newVersion,
        ];
    }

    /**
     * Reject a proposed run without modifying the current draft (`POST /runs/{run}/reject`).
     *
     * @return array<string, mixed>
     */
    public function reject(AiDesignRun $run): array
    {
        if ($run->status !== 'proposed') {
            throw new ApiException(409, 'run_not_proposed', __('ai.designer.run_not_proposed'));
        }

        $run->loadMissing('chat');
        $run->forceFill([
            'status' => 'rejected',
        ])->save();

        return [
            'run' => $this->formatRun($run, $run->chat),
        ];
    }

    /**
     * Revert the latest applied run of a chat back to `previous_draft` (`POST /runs/{run}/revert`).
     *
     * @return array<string, mixed>
     */
    public function revert(AiDesignRun $run, int $version): array
    {
        $run->loadMissing('chat');
        $chat = $run->chat;
        if (
            ! $chat instanceof AiChat
            || $run->status !== 'applied'
            || $run->reverted_at !== null
            || ! is_array($run->previous_draft)
        ) {
            throw new ApiException(409, 'cannot_revert', __('ai.designer.cannot_revert'));
        }

        $latestAppliedId = AiDesignRun::query()
            ->where('chat_id', $chat->id)
            ->where('status', 'applied')
            ->max('id');

        if ((int) $latestAppliedId !== (int) $run->id) {
            throw new ApiException(409, 'cannot_revert', __('ai.designer.cannot_revert'));
        }

        try {
            if ($chat->kind === 'store') {
                $store = Store::query()->firstOrFail();
                $design = $this->storeDesigner->for($store);
                $saved = $this->storeDesigner->save($design, $run->previous_draft, $version);
                $newVersion = $saved->version;
            } else {
                $page = LandingPage::query()->landings()->findOrFail($chat->landing_page_id);
                $saved = $this->savePageContent->handle($page, $version, $run->previous_draft, null);
                $newVersion = $saved->version;
            }
        } catch (ApiException $e) {
            if ($e->status === 409) {
                throw new ApiException(409, 'design_changed', __('ai.designer.design_changed'));
            }

            throw $e;
        }

        $run->forceFill([
            'reverted_at' => now(),
        ])->save();

        return [
            'run' => $this->formatRun($run, $chat),
            'version' => $newVersion,
        ];
    }

    /**
     * Format a run for the dashboard API (`GET /runs/{run}` and inside chat messages).
     *
     * @return array<string, mixed>
     */
    public function formatRun(AiDesignRun $run, ?AiChat $chat = null, bool $withPreviewData = false): array
    {
        if ($chat === null) {
            $run->loadMissing('chat');
            $chat = $run->chat;
        }

        $latestAppliedId = $chat instanceof AiChat
            ? (int) AiDesignRun::query()->where('chat_id', $chat->id)->where('status', 'applied')->max('id')
            : 0;

        $canRevert = $run->status === 'applied'
            && $run->reverted_at === null
            && is_array($run->previous_draft)
            && (int) $run->id === $latestAppliedId;

        $out = [
            'id' => $run->id,
            'chat_id' => $run->chat_id,
            'status' => $run->status,
            'progress' => $run->progress,
            'plan' => $run->plan,
            'image_results' => $run->image_results,
            'section_ids' => $run->section_ids,
            'proposal' => $run->proposal,
            'applied_at' => $run->applied_at?->toIso8601ZuluString(),
            'reverted_at' => $run->reverted_at?->toIso8601ZuluString(),
            'can_revert' => $canRevert,
            'error' => $run->error,
            'created_at' => $run->created_at?->toIso8601ZuluString(),
        ];

        if ($withPreviewData && $chat instanceof AiChat && is_array($run->proposal)) {
            $out['preview_data'] = $this->previewDataForProposal($chat, $run->proposal);
        }

        return $out;
    }

    /**
     * Handle a direct `action: "design"` follow-up reply from the chat (Stage 5.1):
     * replaces placeholders, validates against the theme (with 1 repair turn if needed),
     * and creates a proposed `AiDesignRun` without separate plan steps.
     *
     * @param  list<array{role: 'system'|'user'|'assistant', content: string|list<array<string, string>>}>  $promptMessages
     * @param  array<string, int|string>  $imageResults
     */
    public function createDirectDesignRun(
        Tenant $tenant,
        AiChat $chat,
        string $rawReplyText,
        array $promptMessages,
        array $imageResults = [],
    ): AiDesignRun|array {
        $currentDraft = $this->currentDraft($chat);
        $chatUploadIds = $this->chatUploadedMediaIds($chat);

        $attempt = $this->parseReplaceAndValidate(
            $rawReplyText,
            $chat,
            $currentDraft,
            $chatUploadIds,
            $imageResults,
        );

        if ($attempt['errors'] !== []) {
            $repairMessages = [
                ...$promptMessages,
                ['role' => 'assistant', 'content' => mb_substr($rawReplyText, 0, 40000, 'UTF-8')],
                [
                    'role' => 'user',
                    'content' => "[MKSAB_RUN_DESIGN]\nYour design JSON broke these validation rules:\n- "
                        .implode("\n- ", $attempt['errors'])
                        ."\nReturn the corrected full JSON (`{\"reply\": \"...\", \"action\": \"design\", \"design\": {...}}`) only.",
                ],
            ];

            $repairReply = $this->ai->chatPaid(
                $tenant,
                'designer',
                'designer',
                $repairMessages,
                ['max_tokens' => AiDesigner::MAX_OUTPUT_TOKENS, 'json' => true],
                'المصمم الذكي: إصلاح تصميم',
            );

            $attempt = $this->parseReplaceAndValidate(
                $repairReply->text,
                $chat,
                $currentDraft,
                $chatUploadIds,
                $imageResults,
            );
        }

        if ($attempt['errors'] !== [] || ! is_array($attempt['design'])) {
            return $attempt['errors'] !== [] ? $attempt['errors'] : ['Invalid design output.'];
        }

        return AiDesignRun::query()->create([
            'chat_id' => $chat->id,
            'plan' => null,
            'status' => 'proposed',
            'progress' => 'التصميم جاهز للمعاينة',
            'image_results' => $imageResults === [] ? null : $imageResults,
            'section_ids' => null,
            'proposal' => $attempt['design'],
        ]);
    }

    /**
     * Build the runtime `data` needed to render a whole-page proposal in `PreviewDialog`.
     *
     * @param  array<string, mixed>  $proposal
     * @return array<string, mixed>
     */
    private function previewDataForProposal(AiChat $chat, array $proposal): array
    {
        if ($chat->kind === 'store') {
            $tenant = Tenant::query()->find($chat->tenant_id);

            return [
                'kind' => 'store',
                'theme_key' => $chat->theme_key,
                'store_name' => (string) ($tenant?->name ?? ''),
                'data' => $this->storeDesigner->data($proposal),
            ];
        }

        $page = LandingPage::query()->with(['identity', 'product'])->find($chat->landing_page_id);
        $tenant = Tenant::query()->find($chat->tenant_id);
        $aiResolved = AiSectionDefinitions::resolve($proposal);

        return [
            'kind' => 'landing',
            'theme_key' => $chat->theme_key,
            'store_name' => (string) ($tenant?->name ?? ''),
            'page' => $page instanceof LandingPage ? ['id' => $page->id, 'slug' => $page->slug, 'title' => $page->title] : null,
            'identity' => ($page instanceof LandingPage && $page->identity) ? $this->pageData->identity($page->identity) : null,
            'product' => $page instanceof LandingPage ? $this->pageData->product($page->product) : null,
            'offers' => $page instanceof LandingPage ? $this->pageData->offers($page->product, now()) : [],
            'media' => (object) $this->pageData->media([
                'draft' => $proposal,
                'ai_definitions' => $aiResolved['definitions'],
            ]),
            'shipping' => $this->shipping->publicConfig(now()),
            'reviews' => ($page instanceof LandingPage && $page->product_id !== null)
                ? app(ProductReviews::class)->forProduct($page->product_id)
                : [],
            'ai_sections' => (object) $aiResolved['definitions'],
            'ai_sections_current' => (object) $aiResolved['current'],
        ];
    }

    /**
     * @param  array<string, mixed>  $task
     * @param  list<int>  $chatUploadIds
     */
    private function runSingleImageTask(Tenant $tenant, array $task, array $chatUploadIds): int|string
    {
        $action = trim((string) ($task['action'] ?? ''));
        $prompt = trim((string) ($task['prompt'] ?? ''));
        $use = trim((string) ($task['use'] ?? 'ai-image'));
        $uploadIdx = isset($task['upload']) && is_numeric($task['upload']) ? max(1, (int) $task['upload']) : 1;

        try {
            if (in_array($action, ['remove_bg', 'studio', 'enhance'], true)) {
                $sourceMediaId = $chatUploadIds[$uploadIdx - 1] ?? $chatUploadIds[0] ?? null;
                $dataUrl = $sourceMediaId !== null ? $this->singleMediaDataUrl($sourceMediaId) : null;
                if ($dataUrl === null) {
                    return 'error: '.__('ai.designer.image_failed');
                }

                $instruction = match ($action) {
                    'remove_bg' => 'Isolate the main product and remove the background completely on a clean pure white background. Keep all product details intact.',
                    'studio' => 'Place this exact product on a professional commercial studio background: '
                        .($prompt !== '' ? $prompt : 'clean minimalist studio surface with soft commercial lighting')
                        .'. Keep the product unchanged.',
                    default => 'Enhance the lighting, sharpness, color balance, and commercial studio quality of this product photo while keeping the product faithful.',
                };

                $aiImage = $this->ai->imagePaid(
                    $tenant,
                    'designer',
                    'image_edit',
                    fn ($client, string $model) => $client->editImage($model, $dataUrl, $instruction),
                    'المصمم الذكي: تعديل صورة',
                );

                return $this->images->store($tenant, $aiImage, $use)->id;
            }

            if ($action === 'generate') {
                if ($prompt === '') {
                    return 'error: '.__('ai.designer.image_failed');
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

                return $this->images->store($tenant, $aiImage, $use)->id;
            }

            if ($action === 'stock') {
                if (! $this->stock->configured() || $prompt === '') {
                    return 'error: '.__('ai.designer.image_failed');
                }

                $orientation = str_contains(strtolower($use), 'portrait') ? 'portrait' : 'landscape';
                $photos = $this->stock->search($prompt, 1, $orientation);
                if ($photos === []) {
                    return 'error: '.__('ai.designer.image_failed');
                }

                $photo = $photos[0];

                return $this->images->store($tenant, $photo->toAiImage(), $use, $photo->credit())->id;
            }

            return 'error: '.__('ai.designer.image_failed');
        } catch (ApiException $e) {
            return 'error: '.$e->getMessage();
        } catch (Throwable $e) {
            report($e);

            return 'error: '.__('ai.designer.image_failed');
        }
    }

    private function buildAndApproveCustomSection(
        Tenant $tenant,
        AiChat $chat,
        string $title,
        string $requestText,
    ): ?int {
        $systemPrompt = (string) file_get_contents(resource_path('prompts/ai-designer.md'));
        $messages = [
            [
                'role' => 'system',
                'content' => $systemPrompt."\n\n## CURRENT CONTEXT\nKind: {$chat->kind}\nTheme: {$chat->theme_key}\nStore name: {$tenant->name}",
            ],
            [
                'role' => 'user',
                'content' => "Design a custom AI section (`\"action\": \"section\"`) for this {$chat->kind} ({$chat->theme_key}):\nTitle: {$title}\nRequest: {$requestText}\nReturn valid JSON only.",
            ],
        ];

        $reply = $this->ai->chatPaid(
            $tenant,
            'designer',
            'designer',
            $messages,
            ['max_tokens' => AiDesigner::MAX_OUTPUT_TOKENS, 'json' => true],
            'المصمم الذكي: قسم خاص ('.$title.')',
        );

        $decoded = AiDesigner::decodeJson($reply->text);
        $secData = is_array($decoded['section'] ?? null) ? $decoded['section'] : null;

        $built = is_array($secData) ? $this->sectionBuilder->fromAi($secData, $chat, null) : ['Invalid section JSON.'];

        if (is_array($built)) {
            $repairMessages = [
                ...$messages,
                ['role' => 'assistant', 'content' => mb_substr($reply->text, 0, 40000, 'UTF-8')],
                [
                    'role' => 'user',
                    'content' => "Your section JSON broke these rules:\n- ".implode("\n- ", $built)."\nReturn the corrected full JSON only.",
                ],
            ];

            $repairReply = $this->ai->chatPaid(
                $tenant,
                'designer',
                'designer',
                $repairMessages,
                ['max_tokens' => AiDesigner::MAX_OUTPUT_TOKENS, 'json' => true],
                'المصمم الذكي: إصلاح قسم خاص',
            );

            $decoded2 = AiDesigner::decodeJson($repairReply->text);
            $secData2 = is_array($decoded2['section'] ?? null) ? $decoded2['section'] : null;
            $built = is_array($secData2) ? $this->sectionBuilder->fromAi($secData2, $chat, null) : ['Invalid section JSON.'];
        }

        if (is_array($built)) {
            Log::warning('ai.design_runner.custom_section_failed', [
                'chat_id' => $chat->id,
                'title' => $title,
                'errors' => $built,
            ]);

            return null;
        }

        // Auto-approve into a new AiSection of this theme (up to MAX_PER_THEME)
        return DB::transaction(function () use ($chat, $built): ?int {
            $activeCount = AiSection::query()
                ->forTheme($chat->kind, $chat->theme_key)
                ->whereNull('archived_at')
                ->lockForUpdate()
                ->count();

            if ($activeCount >= AiSection::MAX_PER_THEME) {
                return null;
            }

            $section = AiSection::query()->create([
                'kind' => $chat->kind,
                'theme_key' => $chat->theme_key,
                'name' => $built->name,
                'current_version_id' => $built->id,
            ]);

            $built->forceFill([
                'ai_section_id' => $section->id,
                'status' => 'approved',
                'decided_at' => now(),
            ])->save();

            return $section->id;
        });
    }

    /**
     * @param  array<string, mixed>  $currentDraft
     * @param  array<string, mixed>  $plan
     * @param  array<string, int|string>  $imageResults
     * @param  array<string, int>  $sectionIds
     * @return list<array{role: 'system'|'user'|'assistant', content: string}>
     */
    private function buildDesignPromptMessages(
        Tenant $tenant,
        AiChat $chat,
        array $currentDraft,
        array $plan,
        array $imageResults,
        array $sectionIds,
        int $uploadCount,
    ): array {
        $systemPrompt = (string) file_get_contents(resource_path('prompts/ai-designer.md'));
        $themeDoc = $this->themeDocument($chat->theme_key);

        $context = implode("\n", [
            '## CURRENT CONTEXT',
            "Kind: {$chat->kind}",
            "Theme: {$chat->theme_key}",
            "Store name: {$tenant->name}",
            '',
            '## THEME SPECIFICATION DOCUMENT',
            $themeDoc,
        ]);

        $userInstruction = implode("\n", [
            '[MKSAB_RUN_DESIGN]',
            'Build the complete theme design JSON (`"action": "design"`, `"design": { "settings": {...}, "sections": [...] }`) following the approved plan and the Theme Specification Document.',
            'Available merchant uploaded photos: '.($uploadCount > 0 ? "upload:1 through upload:{$uploadCount}" : 'none'),
            'Plan image task results (`"image:ID"` allowed when value is an integer media ID): '.json_encode($imageResults, JSON_UNESCAPED_UNICODE),
            'Approved custom AI section IDs (insert as `{"id": "sec_custom_...", "type": "ai", "visible": true, "props": {"ai_section_id": <ID>, "values": {}}}`): '.json_encode($sectionIds, JSON_UNESCAPED_UNICODE),
            'Approved Plan JSON: '.json_encode($plan, JSON_UNESCAPED_UNICODE),
            'Current Draft JSON (use `"keep"` to preserve any current image field): '.json_encode($currentDraft, JSON_UNESCAPED_UNICODE),
        ]);

        return [
            ['role' => 'system', 'content' => $systemPrompt."\n\n".$context],
            ['role' => 'user', 'content' => $userInstruction],
        ];
    }

    /**
     * @param  array<string, mixed>  $currentDraft
     * @param  list<int>  $chatUploadIds
     * @param  array<string, int|string>  $imageResults
     * @return array{design: array<string, mixed>|null, errors: list<string>}
     */
    private function parseReplaceAndValidate(
        string $rawText,
        AiChat $chat,
        array $currentDraft,
        array $chatUploadIds,
        array $imageResults,
    ): array {
        $decoded = AiDesigner::decodeJson($rawText);
        if (! is_array($decoded)) {
            return ['design' => null, 'errors' => ['Response is not valid JSON.']];
        }

        $rawDesign = is_array($decoded['design'] ?? null)
            ? $decoded['design']
            : (isset($decoded['settings'], $decoded['sections']) ? $decoded : null);

        if (! is_array($rawDesign)) {
            return ['design' => null, 'errors' => ['Field "design" with "settings" and "sections" is required.']];
        }

        $placeholderErrors = [];
        $replaced = $this->replacePlaceholders(
            $rawDesign,
            '',
            $currentDraft,
            $chatUploadIds,
            $imageResults,
            $placeholderErrors,
        );

        if ($placeholderErrors !== []) {
            return ['design' => null, 'errors' => array_values(array_unique($placeholderErrors))];
        }

        try {
            if ($chat->kind === 'store') {
                $clean = $this->storeThemes->for($chat->theme_key)->validate($replaced, 'draft');
            } else {
                $clean = $this->landingThemes->clean($chat->theme_key, $replaced, 'content', 'landing');
            }

            if (isset($clean['sections']) && is_array($clean['sections'])) {
                $clean['sections'] = $this->seedEmptyAiSectionValues($clean['sections'], $currentDraft, $chat->kind);
            }

            return ['design' => $clean, 'errors' => []];
        } catch (ValidationException $e) {
            $msgs = [];
            foreach ($e->errors() as $field => $fieldErrors) {
                foreach ($fieldErrors as $err) {
                    $msgs[] = "{$field}: {$err}";
                }
            }

            return ['design' => null, 'errors' => $msgs !== [] ? $msgs : ['Design validation failed.']];
        } catch (Throwable $e) {
            return ['design' => null, 'errors' => [$e->getMessage()]];
        }
    }

    /**
     * Populate initial sample/default values on newly placed or empty AI sections so previews,
     * drafts, and published pages never render blank placeholders as empty content.
     *
     * @param  list<array<string, mixed>>  $sections
     * @param  array<string, mixed>  $currentDraft
     * @return list<array<string, mixed>>
     */
    private function seedEmptyAiSectionValues(array $sections, array $currentDraft, string $kind): array
    {
        $aiSections = AiSectionDefinitions::loadSections($sections);
        if ($aiSections->isEmpty()) {
            return $sections;
        }

        $knownSectionIds = [];
        foreach ((array) ($currentDraft['sections'] ?? []) as $draftSec) {
            if (is_array($draftSec) && ($draftSec['type'] ?? null) === 'ai') {
                $id = (int) ($draftSec['props']['ai_section_id'] ?? 0);
                if ($id > 0) {
                    $knownSectionIds[$id] = true;
                }
            }
        }

        foreach ($sections as $i => $section) {
            if (! is_array($section) || ($section['type'] ?? null) !== 'ai') {
                continue;
            }
            $props = is_array($section['props'] ?? null) ? $section['props'] : [];
            $aiSectionId = (int) ($props['ai_section_id'] ?? 0);
            $existingValues = is_array($props['values'] ?? null) ? $props['values'] : [];
            if ($existingValues !== [] && isset($knownSectionIds[$aiSectionId])) {
                continue;
            }

            $aiSection = $aiSections->get($aiSectionId);
            if (! $aiSection instanceof AiSection || $aiSection->current === null) {
                continue;
            }

            $fields = is_array($aiSection->current->fields) ? $aiSection->current->fields : [];
            $defaults = AiSectionFields::defaultValues($fields, $kind);
            $sections[$i]['props']['values'] = $existingValues === []
                ? $defaults
                : array_replace($defaults, $existingValues);
        }

        return $sections;
    }

    /**
     * Replace `"upload:N"`, `"image:ID"`, and `"keep"` placeholders recursively (§4.5 step 4).
     *
     * @param  array<string, mixed>  $currentDraft
     * @param  list<int>  $chatUploadIds
     * @param  array<string, int|string>  $imageResults
     * @param  list<string>  $errors
     */
    private function replacePlaceholders(
        mixed $node,
        string $path,
        array $currentDraft,
        array $chatUploadIds,
        array $imageResults,
        array &$errors,
    ): mixed {
        if (is_array($node)) {
            $out = [];
            $isList = array_is_list($node);
            $lastSegment = (string) last(explode('.', $path));
            $isMediaIdsList = str_ends_with($lastSegment, '_media_ids');

            foreach ($node as $k => $v) {
                $childPath = $path === '' ? (string) $k : "{$path}.{$k}";
                $resolved = $this->replacePlaceholders($v, $childPath, $currentDraft, $chatUploadIds, $imageResults, $errors);
                if ($isMediaIdsList && $resolved === null) {
                    continue;
                }
                $out[$k] = $resolved;
            }

            return $isList ? array_values($out) : $out;
        }

        if (! is_string($node)) {
            return $node;
        }

        $trimmed = trim($node);

        if ($trimmed === 'keep') {
            return data_get($currentDraft, $path);
        }

        if (preg_match('/^upload:(\d+)$/i', $trimmed, $m)) {
            $idx = (int) $m[1] - 1;
            if ($idx >= 0 && isset($chatUploadIds[$idx])) {
                return $chatUploadIds[$idx];
            }
            $errors[] = "Unknown upload placeholder '{$trimmed}' at '{$path}'.";

            return null;
        }

        if (preg_match('/^image:([A-Za-z0-9_-]+)$/i', $trimmed, $m)) {
            $imgKey = $m[1];
            if (! array_key_exists($imgKey, $imageResults)) {
                $errors[] = "Unknown image placeholder '{$trimmed}' at '{$path}'.";

                return null;
            }
            $res = $imageResults[$imgKey];
            if (is_int($res)) {
                return $res;
            }

            // Image task had failed: fall back to null so optional media fields can still validate
            return null;
        }

        return $node;
    }

    /**
     * Collect all merchant-uploaded media IDs across this chat in chronological order (1-based `upload:N`).
     *
     * @return list<int>
     */
    public function chatUploadedMediaIds(AiChat $chat): array
    {
        $ids = [];
        $userMessages = AiChatMessage::query()
            ->where('chat_id', $chat->id)
            ->where('role', 'user')
            ->orderBy('id')
            ->get(['media_ids']);

        foreach ($userMessages as $msg) {
            if (is_array($msg->media_ids)) {
                foreach ($msg->media_ids as $id) {
                    $intId = (int) $id;
                    if ($intId > 0 && ! in_array($intId, $ids, true)) {
                        $ids[] = $intId;
                    }
                }
            }
        }

        return $ids;
    }

    /**
     * @return array<string, mixed>
     */
    public function currentDraft(AiChat $chat): array
    {
        if ($chat->kind === 'store') {
            $store = Store::query()->first();
            if ($store instanceof Store) {
                $design = $this->storeDesigner->for($store);

                return is_array($design->draft) ? $design->draft : $this->storeDesigner->defaults($chat->theme_key);
            }

            return $this->storeDesigner->defaults($chat->theme_key);
        }

        if ($chat->landing_page_id !== null) {
            $page = LandingPage::query()->find($chat->landing_page_id);
            if ($page instanceof LandingPage && is_array($page->draft_content)) {
                return $page->draft_content;
            }
        }

        return $this->landingThemes->starter($chat->theme_key, null);
    }

    public function themeDocument(string $themeKey): string
    {
        $path = resource_path("prompts/themes/{$themeKey}.md");
        if (is_file($path)) {
            return (string) file_get_contents($path);
        }

        return (string) file_get_contents(resource_path('prompts/themes/asas_store.md'));
    }

    /**
     * @return list<string>
     */
    private function allowedSectionTypes(AiChat $chat): array
    {
        if ($chat->kind === 'store') {
            $theme = $this->storeThemes->for($chat->theme_key);

            return $theme::SECTION_TYPES;
        }

        $theme = $this->landingThemes->for($chat->theme_key);

        return $theme !== null ? $theme::SECTION_TYPES : [];
    }

    private function maxSections(AiChat $chat): int
    {
        if ($chat->kind === 'store') {
            $theme = $this->storeThemes->for($chat->theme_key);

            return $theme::MAX_SECTIONS;
        }

        $theme = $this->landingThemes->for($chat->theme_key);

        return $theme !== null ? $theme::MAX_SECTIONS : 12;
    }

    /**
     * @return array{primary: string, secondary: string, background: string, text: string}
     */
    private function defaultThemeColors(AiChat $chat): array
    {
        return match ($chat->theme_key) {
            'sufi_store', 'sufi_landing' => ['primary' => '#b9844f', 'secondary' => '#17181c', 'background' => '#faf8f4', 'text' => '#17181c'],
            'shabe_store', 'shabe_landing' => ['primary' => '#e4572e', 'secondary' => '#f2b33d', 'background' => '#fffaf2', 'text' => '#1b120c'],
            default => ['primary' => '#0b875b', 'secondary' => '#ffc83d', 'background' => '#ffffff', 'text' => '#13261d'],
        };
    }

    private function singleMediaDataUrl(int $mediaId): ?string
    {
        return MediaDataUrl::for($mediaId);
    }

    private function failRun(AiDesignRun $run, string $error): void
    {
        $run->forceFill([
            'status' => 'failed',
            'error' => mb_substr($error, 0, 300, 'UTF-8'),
        ])->save();
    }
}
