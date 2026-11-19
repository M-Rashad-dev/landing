<?php

declare(strict_types=1);

namespace App\Ai;

use App\Models\SupportAttachment;
use App\Models\SupportMessage;
use App\Models\SupportTicket;
use App\Models\Tenant;
use App\Services\Support\SupportDesk;
use App\Services\Support\SupportFiles;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * «مساعد مكسب»: answers a conversation the assistant handles (run inside the store's tenant, from
 * the AnswerSupport job). It reads the merchant's new messages (and screenshots), the nearest
 * knowledge pieces and the store's own data, answers in the chat, and hands the conversation to
 * people when asked, when it can't help twice, or for insults, serious accusations and money
 * disputes. Any trouble (AI off, limit, failure, a reply it can't read) also hands over: the
 * merchant is never left without an answer.
 */
final class SupportAssistant
{
    public const REASONS = ['request', 'abuse', 'serious', 'money', 'unsolved', 'limit', 'unavailable', 'staff'];

    /** Messages of the conversation the model sees (oldest dropped). */
    private const HISTORY = 12;

    /** Screenshots read per answer, and their size limit. */
    private const IMAGES = 3;

    private const IMAGE_BYTES = 4_000_000;

    public function __construct(
        private readonly Ai $ai,
        private readonly AiSettings $settings,
        private readonly Knowledge $knowledge,
        private readonly MerchantSnapshot $snapshot,
        private readonly SupportDesk $desk,
        private readonly SupportFiles $files,
    ) {}

    /** Whether a new conversation goes to the assistant now. */
    public function takesNew(): bool
    {
        return $this->ai->available('support');
    }

    public function answer(SupportTicket $ticket): void
    {
        if ($ticket->handler !== SupportTicket::HANDLER_AI || ! $ticket->status->isOpen() || ! $this->merchantWaiting($ticket)) {
            return;
        }
        if ($this->answeredToday() >= $this->settings->supportDailyMessages()) {
            $this->desk->handOff($ticket, 'limit', null);

            return;
        }

        try {
            $result = $this->ask($ticket);
        } catch (Throwable $e) {
            if (! $e instanceof AiUnavailable) {
                report($e);
            }
            $this->desk->handOff($ticket, 'unavailable', null);

            return;
        }

        $reply = trim((string) ($result['reply'] ?? ''));
        $handoff = (bool) ($result['handoff'] ?? false);
        $answered = (bool) ($result['answered'] ?? true);
        $sources = array_values(array_filter(array_map('intval', (array) ($result['sources'] ?? []))));

        if ($reply !== '') {
            $this->desk->assistantReply($ticket, $reply, $sources);
        }
        if ($handoff) {
            $reason = in_array($result['reason'] ?? null, self::REASONS, true) ? (string) $result['reason'] : 'request';
            $this->desk->handOff($ticket->refresh(), $reason, self::summary($result['summary'] ?? null));

            return;
        }
        $misses = $answered ? 0 : $ticket->ai_misses + 1;
        $ticket->forceFill(['ai_misses' => $misses])->save();
        if ($misses >= 2 || $reply === '') {
            $this->desk->handOff($ticket->refresh(), 'unsolved', null);
        }
    }

    /**
     * A short summary for the staff when the merchant asked for a person with the button (the
     * assistant didn't decide it, so nobody wrote one). Silent when the AI can't be asked.
     */
    public function summarize(SupportTicket $ticket): void
    {
        if ($ticket->handoff_summary !== null) {
            return;
        }
        try {
            $reply = $this->ai->chat('support', 'support', [
                ['role' => 'system', 'content' => 'لخّص محادثة الدعم دي للموظف في 2 لـ 4 سطور بالعربي: المشكلة، واللي اتجرب، والتاجر عايز إيه. اكتب الملخص بس.'],
                ['role' => 'user', 'content' => $this->transcript($ticket)],
            ], ['max_tokens' => 900, 'temperature' => 0.2], $ticket->tenant_id);
            $ticket->forceFill(['handoff_summary' => self::summary($reply->text)])->save();
        } catch (AiUnavailable) {
            // No summary: the staff reads the conversation itself.
        }
    }

    /**
     * @return array<string, mixed>
     *
     * @throws AiUnavailable
     */
    private function ask(SupportTicket $ticket): array
    {
        $tenant = Tenant::query()->findOrFail($ticket->tenant_id);
        $history = SupportMessage::query()->with('attachments')->where('support_ticket_id', $ticket->id)
            ->reorder('id', 'desc')->limit(self::HISTORY)->get()->reverse()->values();
        $lastHelp = $history->filter(fn (SupportMessage $m) => $m->sender !== SupportMessage::MERCHANT && $m->sender !== SupportMessage::SYSTEM)->max('id') ?? 0;
        $fresh = $history->filter(fn (SupportMessage $m) => $m->sender === SupportMessage::MERCHANT && $m->id > $lastHelp);
        // The merchant's own words find the knowledge (the topic goes with the store data).
        $question = trim($fresh->pluck('body')->filter()->implode("\n"));

        $pieces = $question === '' ? [] : $this->knowledge->search($question, $ticket->tenant_id);
        $knowledge = $pieces === []
            ? 'KNOWLEDGE: (nothing matched)'
            : "KNOWLEDGE:\n".implode("\n\n", array_map(fn (array $p) => "[{$p['article_id']}] {$p['text']}", $pieces));

        $messages = [
            ['role' => 'system', 'content' => (string) file_get_contents(resource_path('prompts/support-assistant.md'))],
            ['role' => 'system', 'content' => $knowledge."\n\nSTORE DATA:\n".$this->snapshot->text($tenant)."\n\nCONVERSATION TOPIC: ".__('support.topics.'.$ticket->topic->value)],
        ];
        foreach ($history as $message) {
            if ($message->sender === SupportMessage::SYSTEM) {
                continue;
            }
            $merchant = $message->sender === SupportMessage::MERCHANT;
            $text = (string) $message->body;
            $images = $merchant && $message->id > $lastHelp ? $this->images($message) : [];
            if ($images !== []) {
                $parts = [['type' => 'text', 'text' => $text !== '' ? $text : '(صورة)']];
                foreach ($images as $url) {
                    $parts[] = ['type' => 'image', 'url' => $url];
                }
                $messages[] = ['role' => 'user', 'content' => $parts];
            } elseif ($text !== '') {
                $messages[] = ['role' => $merchant ? 'user' : 'assistant', 'content' => $text];
            }
        }

        // Some models drift from the shape after a long context (one answered only «[41]»): remind at the end.
        $messages[] = ['role' => 'system', 'content' => 'Answer with ONE JSON object only: {"reply": "...", "answered": true|false, "handoff": true|false, "reason": null|"...", "summary": null|"...", "sources": [ids]}. Never a bare list.'];
        $reply = $this->ai->chat('support', 'support', $messages, ['json' => true, 'max_tokens' => 2000, 'temperature' => 0.3], $ticket->tenant_id);
        $json = Designer\AiDesigner::decodeJson($reply->text);
        if (! is_array($json) || trim((string) ($json['reply'] ?? '')) === '') {
            // One more try, showing it the broken answer.
            $retry = [...$messages, ['role' => 'assistant', 'content' => mb_substr($reply->text, 0, 2000)], ['role' => 'user', 'content' => 'That was not the required JSON object. Return the full JSON object with a non-empty "reply" in Egyptian Arabic.']];
            $reply = $this->ai->chat('support', 'support', $retry, ['json' => true, 'max_tokens' => 2000, 'temperature' => 0.3], $ticket->tenant_id);
            $json = Designer\AiDesigner::decodeJson($reply->text);
        }
        if (! is_array($json) || trim((string) ($json['reply'] ?? '')) === '') {
            Log::warning('ai.support.invalid_output', ['ticket' => $ticket->id, 'raw_preview' => mb_substr($reply->text, 0, 500)]);
            throw new AiUnavailable(AiUnavailable::FAILED);
        }
        // Only articles it was given count as sources.
        $given = array_column($pieces, 'article_id');
        $json['sources'] = array_values(array_intersect(array_map('intval', (array) ($json['sources'] ?? [])), $given));

        return $json;
    }

    /** The merchant wrote after the last answer (the assistant's, staff's or the conversation's start). */
    private function merchantWaiting(SupportTicket $ticket): bool
    {
        $last = SupportMessage::query()->where('support_ticket_id', $ticket->id)->where('sender', '!=', SupportMessage::SYSTEM)->reorder('id', 'desc')->first();

        return $last?->sender === SupportMessage::MERCHANT;
    }

    /** The assistant's answers to this store today (Cairo day): the merchants' daily limit. */
    private function answeredToday(): int
    {
        return SupportMessage::query()->where('sender', SupportMessage::AI)->where('created_at', '>=', Ai::todayStart())->count();
    }

    /** @return list<string> data URLs of the message's images (the provider can't reach our private files). */
    private function images(SupportMessage $message): array
    {
        $urls = [];
        foreach ($message->attachments->where('kind', 'image')->take(self::IMAGES) as $attachment) {
            /** @var SupportAttachment $attachment */
            $path = $this->files->absolutePath($attachment);
            if (is_file($path) && filesize($path) <= self::IMAGE_BYTES) {
                $urls[] = 'data:'.$attachment->mime.';base64,'.base64_encode((string) file_get_contents($path));
            }
        }

        return $urls;
    }

    private function transcript(SupportTicket $ticket): string
    {
        return SupportMessage::query()->where('support_ticket_id', $ticket->id)->where('sender', '!=', SupportMessage::SYSTEM)
            ->reorder('id', 'desc')->limit(self::HISTORY)->get()->reverse()
            ->map(fn (SupportMessage $m) => ($m->sender === SupportMessage::MERCHANT ? 'التاجر: ' : 'الدعم: ').$m->body)->implode("\n");
    }

    private static function summary(mixed $text): ?string
    {
        $text = is_string($text) ? trim(strip_tags($text)) : '';

        return $text === '' ? null : mb_substr($text, 0, 1000);
    }
}
