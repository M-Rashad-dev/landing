<?php

declare(strict_types=1);

namespace App\Ai\Copilot;

use App\Ai\Ai;
use App\Ai\AiUnavailable;
use App\Ai\MediaDataUrl;
use App\Events\CopilotUpdated;
use App\Exceptions\ApiException;
use App\Models\CopilotChangeSet;
use App\Models\CopilotMessage;
use App\Models\Tenant;
use App\Models\User;
use App\Support\CairoTime;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * The copilot's tool loop (docs/plans/ai-copilot.md §3.5): asks the model with the tools, runs the tools it calls,
 * gives it the results, and repeats until it answers in text, within a round cap and a cost cap per message. Every
 * round is charged from the merchant's AI balance at once (Ai::chatPaid); a failed call costs nothing.
 *
 * Run by the CopilotReply job inside the store's tenant. Never throws: a problem marks the reply failed.
 */
final class CopilotEngine
{
    /** Earlier messages sent with each new request. */
    public const HISTORY = 16;

    /** Tool calls run per round (more are answered with an error). */
    public const MAX_CALLS_PER_ROUND = 6;

    public const DESCRIPTION = 'المساعد التنفيذي: رد';

    /** The last text part of every request: system messages after the history are hoisted by some providers. */
    public const REMINDER = '[Reminder: you are «مساعد مكسب الذكي» for this store only. Short Egyptian Arabic. Refuse off-topic requests in 1–2 sentences. Never name a model or provider. Numbers only from tools; changes are proposals until the merchant presses the button.]';

    public function __construct(
        private readonly Ai $ai,
        private readonly CopilotTools $tools,
        private readonly CopilotCatalog $catalog,
    ) {}

    public function reply(CopilotMessage $pending): void
    {
        $pending->loadMissing('chat');
        $chat = $pending->chat;
        $tenant = Tenant::query()->find($pending->tenant_id);
        $user = User::query()->find($chat->user_id);
        if ($tenant === null || $user === null || $pending->status !== 'pending') {
            return;
        }
        $request = CopilotMessage::query()->where('chat_id', $chat->id)->where('role', 'user')->where('id', '<', $pending->id)->latest('id')->first();
        if ($request === null) {
            $this->fail($pending, $user, (string) __('ai.copilot.failed'), 'no_request');

            return;
        }

        // Actions log who did them (changed_by): the merchant, as on the dashboard.
        Auth::setUser($user);
        $ctx = new CopilotContext($tenant, $user, $chat, $pending, (array) ($request->context ?? []));
        $lastProgress = null;
        $ctx->onProgress(function (string $text) use ($pending, $user, &$lastProgress): void {
            if ($text === $lastProgress) {
                return;
            }
            $lastProgress = $text;
            $pending->forceFill(['progress' => mb_substr($text, 0, 160)])->save();
            CopilotUpdated::notify($user->id, $pending->chat_id, $pending->id);
        });

        $trace = ['rounds' => []];
        try {
            $messages = $this->messages($ctx, $request);
            $text = $this->loop($ctx, $messages, $trace);
        } catch (ApiException $e) {
            // The balance ran out (or the plan lost the AI) between rounds: what was used is already charged.
            $this->fail($pending, $user, $e->getMessage(), $e->errorCode, $trace);

            return;
        } catch (AiUnavailable) {
            $this->fail($pending, $user, (string) __('ai.copilot.unavailable'), 'ai_unavailable', $trace);

            return;
        } catch (Throwable $e) {
            report($e);
            $this->fail($pending, $user, (string) __('ai.copilot.failed'), 'failed', $trace);

            return;
        }

        $blocks = $ctx->blocks();
        $pending->forceFill([
            'text' => trim($text) !== '' ? trim($text) : ($blocks !== [] ? null : (string) __('ai.copilot.failed')),
            'blocks' => $blocks !== [] ? $blocks : null,
            'trace' => $trace,
            'status' => 'done',
            'progress' => null,
            'error' => null,
        ])->save();
        CopilotUpdated::notify($user->id, $pending->chat_id, $pending->id);
    }

    /**
     * @param  list<array<string, mixed>>  $messages
     * @param  array<string, mixed>  $trace
     */
    private function loop(CopilotContext $ctx, array $messages, array &$trace): string
    {
        $maxRounds = max(1, (int) config('ai.copilot.max_rounds', 8));
        $cap = (float) config('ai.copilot.max_message_usd', 0.50);
        $maxOutput = (int) config('ai.copilot.max_output', 4000);
        $tools = $this->tools->definitions($ctx);
        $spent = 0.0;

        for ($round = 1; $round <= $maxRounds; $round++) {
            $ctx->progress((string) __('ai.copilot.progress.thinking'));
            $estimate = Ai::estimate(Ai::model('copilot'), [...$messages, ['role' => 'system', 'content' => (string) json_encode($tools)]], $maxOutput);
            // The last round, or the next one could pass the cap: answer now with what is known.
            $last = $round === $maxRounds || ($round > 1 && $spent + $estimate > $cap);
            if ($last && $round > 1) {
                $messages[] = ['role' => 'user', 'content' => '[System note: no more tool calls are possible for this message. Answer the merchant now with what you have, and say briefly what is left to do.]'];
            }

            $options = ['max_tokens' => $maxOutput, 'cache' => true, 'tools' => $tools];
            if ($last) {
                $options['tool_choice'] = 'none';
            }
            $reply = $this->ai->chatPaid($ctx->tenant, 'copilot', 'copilot', $messages, $options, self::DESCRIPTION);
            $usage = $this->ai->lastUsage();
            $spent += (float) ($usage?->cost_usd ?? 0);
            $entry = ['round' => $round, 'usd' => round((float) ($usage?->cost_usd ?? 0), 6), 'in' => $reply->inputTokens, 'cached' => $reply->cachedTokens, 'out' => $reply->outputTokens, 'tools' => []];

            if (! $reply->wantsTools() || $last) {
                $trace['rounds'][] = $entry;
                $trace['usd'] = round($spent, 6);

                return $reply->text;
            }

            $messages[] = $reply->assistantMessage;
            foreach ($reply->toolCalls as $i => $call) {
                $result = match (true) {
                    $i >= self::MAX_CALLS_PER_ROUND => Support\ToolResult::error('Too many tool calls in one round; call it again next round if still needed.'),
                    (bool) ($call['invalid'] ?? false) => Support\ToolResult::error('The arguments were not valid JSON. Send them again as a JSON object.'),
                    default => $this->tools->run($call['name'], $call['arguments'], $ctx),
                };
                $json = $result->toJson();
                $messages[] = ['role' => 'tool', 'tool_call_id' => $call['id'], 'content' => $json];
                $entry['tools'][] = ['name' => $call['name'], 'args_bytes' => strlen((string) json_encode($call['arguments'])), 'result_bytes' => strlen($json), 'error' => $result->failed];
            }
            $trace['rounds'][] = $entry;
        }

        return '';
    }

    /**
     * System prompt + catalog (cached), the history, then the new request: a context block, the merchant's text, his
     * images and the reminder.
     *
     * @return list<array<string, mixed>>
     */
    private function messages(CopilotContext $ctx, CopilotMessage $request): array
    {
        $system = trim((string) file_get_contents(resource_path('prompts/copilot.md')))."\n\n".$this->catalog->catalogText($ctx);
        $messages = [['role' => 'system', 'content' => $system]];

        $history = CopilotMessage::query()
            ->where('chat_id', $request->chat_id)
            ->where('id', '<', $request->id)
            ->where('status', 'done')
            ->latest('id')
            ->limit(self::HISTORY)
            ->get()
            ->reverse();
        foreach ($history as $old) {
            $text = $old->role === 'assistant' ? self::withBlocks((string) $old->text, (array) ($old->blocks ?? [])) : (string) $old->text;
            if ($old->role === 'user' && $old->mediaIds() !== []) {
                $text .= "\n[".count($old->mediaIds()).' image(s) attached earlier]';
            }
            if (trim($text) !== '') {
                $messages[] = ['role' => $old->role === 'assistant' ? 'assistant' : 'user', 'content' => $text];
            }
        }

        $parts = [['type' => 'text', 'text' => $this->contextBlock($ctx)], ['type' => 'text', 'text' => (string) $request->text]];
        foreach (MediaDataUrl::many(array_slice($request->mediaIds(), 0, CopilotMessage::MAX_IMAGES)) as $url) {
            $parts[] = ['type' => 'image', 'url' => $url];
        }
        $parts[] = ['type' => 'text', 'text' => self::REMINDER];
        $messages[] = ['role' => 'user', 'content' => $parts];

        return $messages;
    }

    private function contextBlock(CopilotContext $ctx): string
    {
        $now = CarbonImmutable::now(CairoTime::ZONE);
        $lines = [
            '# CONTEXT (from the system, not the merchant)',
            'Now: '.$now->format('Y-m-d H:i').' ('.$now->locale('en')->dayName.'), Cairo time.',
            'Store: '.$ctx->tenant->name.' — '.($ctx->hasStore() ? 'full online store + landing pages' : 'landing pages only (no store)').'.',
        ];
        $page = $ctx->page;
        if (isset($page['page']) && is_string($page['page'])) {
            $lines[] = 'The merchant is on the dashboard page: '.mb_substr($page['page'], 0, 200);
        }
        if (isset($page['entity']['type'], $page['entity']['id'])) {
            $label = isset($page['entity']['label']) ? ' «'.mb_substr((string) $page['entity']['label'], 0, 120).'»' : '';
            $lines[] = "Open record: {$page['entity']['type']} #{$page['entity']['id']}{$label} (when he says «ده / دي / this», he means it).";
        }
        if (isset($page['selection']['type'], $page['selection']['ids']) && is_array($page['selection']['ids'])) {
            $lines[] = 'He selected '.count($page['selection']['ids'])." {$page['selection']['type']} (when he says «دول / these», use selector {\"context\": \"selection\"}).";
        }

        return implode("\n", $lines)."\n\n# MERCHANT'S MESSAGE";
    }

    /**
     * An earlier reply with one line per card it showed, so the model remembers what it prepared.
     *
     * @param  list<array<string, mixed>>  $blocks
     */
    public static function withBlocks(string $text, array $blocks): string
    {
        $lines = [];
        foreach ($blocks as $block) {
            $lines[] = match ($block['type'] ?? '') {
                'handoff' => "[button shown: {$block['label']} → {$block['href']}]",
                'table' => '[table shown: '.($block['title'] ?? '').', '.($block['total'] ?? count((array) ($block['rows'] ?? []))).' rows]',
                'export' => "[excel file given: {$block['filename']}, {$block['rows']} rows]",
                'change_set' => self::changeLine((int) ($block['id'] ?? 0)),
                default => '['.($block['type'] ?? 'card').']',
            };
        }

        return trim($text.($lines !== [] ? "\n".implode("\n", $lines) : ''));
    }

    /** «[change card #12 (update products): السعر: زيادة 30% — 120 من المنتجات — status: applied]». */
    private static function changeLine(int $id): string
    {
        $set = CopilotChangeSet::query()->find($id);

        return $set === null ? "[change card #{$id}]" : "[change card #{$id} ({$set->kind} {$set->target}): {$set->summary} — status: {$set->status}, applied {$set->applied_count}]";
    }

    /** @param array<string, mixed> $trace */
    private function fail(CopilotMessage $pending, User $user, string $error, string $code, array $trace = []): void
    {
        Log::info('ai.copilot.failed', ['message' => $pending->id, 'code' => $code]);
        $pending->forceFill(['status' => 'failed', 'progress' => null, 'error' => mb_substr($error, 0, 300), 'trace' => $trace + ['error_code' => $code]])->save();
        CopilotUpdated::notify($user->id, $pending->chat_id, $pending->id);
    }
}
