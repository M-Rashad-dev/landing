<?php

declare(strict_types=1);

namespace App\Services\Support;

use App\Ai\Ai;
use App\Enums\SupportStatus;
use App\Enums\SupportTopic;
use App\Events\SupportUpdated;
use App\Exceptions\ApiException;
use App\Jobs\AnswerSupport;
use App\Jobs\SummarizeHandoff;
use App\Models\SupportMessage;
use App\Models\SupportTicket;
use App\Models\Tenant;
use App\Notifications\StoreNotices;
use App\Services\AdminAlerts;
use App\Tenancy\Tenancy;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Every rule of the support chat, run inside the store's tenant:
 * - a new conversation goes to «مساعد مكسب» (App\Ai\SupportAssistant) while the assistant is on;
 *   it moves to people on the merchant's request, the assistant's call, or any trouble, and never back;
 * - a store has at most `max_open` open conversations with people, and opens a new one for people only
 *   `open_gap_hours` after the last one still open was started (a closed one never blocks; the
 *   assistant's conversations never count: it isn't the staff's load);
 * - support's reply hands the turn to the merchant; without an answer for `idle_hours` it closes;
 * - support can close and reopen; the merchant can close; a closed conversation is rated once.
 * Each change is broadcast at once (Reverb); a broadcast failure never fails the action.
 */
final class SupportDesk
{
    public function __construct(
        private readonly SupportFiles $files,
        private readonly SupportPresenter $presenter,
        private readonly AdminAlerts $alerts,
        private readonly StoreNotices $notices,
        private readonly Ai $ai,
    ) {}

    /** Whether a new conversation goes to the assistant now. */
    public function assistantTakesNew(): bool
    {
        return $this->ai->available('support');
    }

    /**
     * Why the store cannot open a conversation now (translated), or null.
     */
    public function cannotOpen(): ?string
    {
        if ($this->assistantTakesNew()) {
            return null;
        }
        $open = SupportTicket::query()->where('status', '!=', SupportStatus::Closed->value)->where('handler', SupportTicket::HANDLER_HUMAN)->get(['id', 'created_at']);
        $max = (int) config('landing.support.max_open');
        if ($open->count() >= $max) {
            return __('support.limit', ['count' => $max]);
        }
        $latest = $open->max('created_at');
        $gap = (int) config('landing.support.open_gap_hours');
        if ($latest !== null && $latest->gt(now()->subHours($gap))) {
            $minutes = (int) ceil(now()->diffInMinutes($latest->copy()->addHours($gap)));
            $time = $minutes >= 60 ? trans_choice('support.hours', (int) ceil($minutes / 60)) : trans_choice('support.minutes', $minutes);

            return __('support.wait', ['time' => $time]);
        }

        return null;
    }

    /**
     * @param  list<UploadedFile>  $files
     * @param  array<string, mixed>  $context  where the merchant was (page, device, plan)
     */
    public function open(int $userId, SupportTopic $topic, ?string $body, array $files, array $context): SupportTicket
    {
        $reason = $this->cannotOpen();
        if ($reason !== null) {
            throw new ApiException(422, 'support_limit', $reason);
        }

        $assistant = $this->assistantTakesNew();
        [$ticket, $message] = DB::transaction(function () use ($userId, $topic, $body, $files, $context, $assistant): array {
            $ticket = SupportTicket::query()->create([
                'user_id' => $userId,
                'topic' => $topic,
                'status' => SupportStatus::WaitingSupport,
                'handler' => $assistant ? SupportTicket::HANDLER_AI : SupportTicket::HANDLER_HUMAN,
                'context' => $context,
                'merchant_read_at' => now(),
            ]);
            $message = $this->write($ticket, SupportMessage::MERCHANT, $userId, $body, $files);

            return [$ticket->refresh(), $message];
        });

        $this->broadcast($ticket, $message);
        if ($assistant) {
            AnswerSupport::dispatch($ticket->tenant_id, $ticket->id)->afterCommit();
        } else {
            $this->alertStaff($ticket, mb_substr((string) $body, 0, 300) ?: '—');
        }

        return $ticket;
    }

    /**
     * A message from the merchant (merchant side) or from support (admin side, inside the store's tenant).
     *
     * @param  list<UploadedFile>  $files
     */
    public function reply(SupportTicket $ticket, string $sender, int $userId, ?string $body, array $files): SupportMessage
    {
        if (! $ticket->status->isOpen()) {
            throw new ApiException(422, 'support_closed', __('support.closed'));
        }
        // Staff writing in the assistant's conversation takes it over.
        if ($sender === SupportMessage::SUPPORT && $ticket->handler === SupportTicket::HANDLER_AI) {
            $this->handOff($ticket, 'staff', null, alert: false);
            $ticket->refresh();
        }
        $merchantWaited = false;
        $message = DB::transaction(function () use ($ticket, $sender, $userId, $body, $files, &$merchantWaited): SupportMessage {
            $locked = SupportTicket::query()->whereKey($ticket->id)->lockForUpdate()->firstOrFail();
            if (! $locked->status->isOpen()) {
                throw new ApiException(422, 'support_closed', __('support.closed'));
            }
            $merchantWaited = $locked->status === SupportStatus::WaitingSupport;

            return $this->write($locked, $sender, $userId, $body, $files);
        });
        $ticket->refresh();
        $this->broadcast($ticket, $message);
        // Told once per answer: the first support message after the merchant wrote (not every line of it).
        if ($sender === SupportMessage::SUPPORT && $merchantWaited) {
            $this->notices->supportReply($ticket);
        }
        if ($sender === SupportMessage::MERCHANT && $ticket->handler === SupportTicket::HANDLER_AI) {
            AnswerSupport::dispatch($ticket->tenant_id, $ticket->id)->afterCommit();
        }

        return $message;
    }

    /** The assistant's answer (with the knowledge articles it used, shown to support only). */
    public function assistantReply(SupportTicket $ticket, string $body, array $sources): SupportMessage
    {
        $message = DB::transaction(function () use ($ticket, $body, $sources): SupportMessage {
            $locked = SupportTicket::query()->whereKey($ticket->id)->lockForUpdate()->firstOrFail();
            $message = SupportMessage::query()->create(['support_ticket_id' => $locked->id, 'sender' => SupportMessage::AI, 'body' => $body, 'sources' => $sources ?: null]);
            $now = now();
            $locked->forceFill(['last_message_at' => $now, 'last_support_message_at' => $now, 'status' => SupportStatus::WaitingMerchant])->save();

            return $message->load('attachments');
        });
        $ticket->refresh();
        $this->broadcast($ticket, $message);

        return $message;
    }

    /**
     * The conversation moves to people, for good: why, a summary for the staff (written by the
     * assistant, or later from the conversation), a note in the chat, and the staff told.
     */
    public function handOff(SupportTicket $ticket, string $reason, ?string $summary, bool $alert = true): void
    {
        if ($ticket->handler !== SupportTicket::HANDLER_AI || ! $ticket->status->isOpen()) {
            return;
        }
        $message = DB::transaction(function () use ($ticket, $reason, $summary): ?SupportMessage {
            $ticket->forceFill([
                'handler' => SupportTicket::HANDLER_HUMAN,
                'handoff_reason' => $reason,
                'handoff_summary' => $summary,
                'handed_off_at' => now(),
                'status' => SupportStatus::WaitingSupport,
            ])->save();

            // Staff taking over just answers; otherwise the merchant is told a person will answer.
            return $reason === 'staff' ? null : $this->system($ticket, 'handed_off');
        });
        $this->broadcast($ticket, $message);
        if ($alert) {
            $preview = __('support.handoff.'.$reason).($summary !== null ? ' — '.$summary : '');
            $this->alertStaff($ticket, mb_substr($preview, 0, 300));
        }
        if ($summary === null && $reason !== 'staff') {
            SummarizeHandoff::dispatch($ticket->tenant_id, $ticket->id)->afterCommit();
        }
    }

    private function alertStaff(SupportTicket $ticket, string $preview): void
    {
        $tenant = Tenant::query()->find($ticket->tenant_id);
        if ($tenant !== null) {
            $this->alerts->supportTicket($tenant, (int) $ticket->number, __('support.topics.'.$ticket->topic->value), $preview);
        }
    }

    /** The reader saw everything up to now ("اتقرت" on the other side). */
    public function read(SupportTicket $ticket, string $side): void
    {
        $column = $side === SupportMessage::SUPPORT ? 'support_read_at' : 'merchant_read_at';
        $ticket->forceFill([$column => now()])->save();
        $this->broadcast($ticket);
    }

    public function close(SupportTicket $ticket, string $by, ?int $userId): void
    {
        if (! $ticket->status->isOpen()) {
            return;
        }
        $message = DB::transaction(function () use ($ticket, $by, $userId): SupportMessage {
            $ticket->forceFill([
                'status' => SupportStatus::Closed,
                'close_reason' => $by,
                'closed_at' => now(),
                'closed_by' => $userId,
            ])->save();

            return $this->system($ticket, 'closed_'.$by);
        });
        $this->broadcast($ticket, $message);
    }

    /** Support opens a closed conversation again (the merchant asked); the rating starts over. */
    public function reopen(SupportTicket $ticket): void
    {
        if ($ticket->status->isOpen()) {
            throw new ApiException(422, 'support_open', __('support.not_closed'));
        }
        $message = DB::transaction(function () use ($ticket): SupportMessage {
            $ticket->forceFill([
                'status' => SupportStatus::WaitingSupport,
                'close_reason' => null,
                'closed_at' => null,
                'closed_by' => null,
                'reopened_count' => $ticket->reopened_count + 1,
                'rating' => null,
                'rating_resolved' => null,
                'rating_comment' => null,
                'rated_at' => null,
            ])->save();

            return $this->system($ticket, 'reopened');
        });
        $this->broadcast($ticket, $message);
    }

    public function rate(SupportTicket $ticket, int $stars, bool $resolved, ?string $comment): void
    {
        if ($ticket->status->isOpen()) {
            throw new ApiException(422, 'support_open', __('support.not_rateable'));
        }
        if ($ticket->rated_at !== null) {
            throw new ApiException(422, 'support_rated', __('support.rated'));
        }
        $ticket->forceFill(['rating' => $stars, 'rating_resolved' => $resolved, 'rating_comment' => $comment, 'rated_at' => now()])->save();
        $this->broadcast($ticket);
    }

    /**
     * Closes conversations waiting for the merchant longer than the idle hours (every store).
     */
    public function closeIdle(): int
    {
        $cutoff = now()->subHours((int) config('landing.support.idle_hours'));
        // Audited bypass: the scheduler has no tenant; each ticket is then closed inside its own store.
        $tickets = Tenancy::withoutTenant(fn () => SupportTicket::query()
            ->where('status', SupportStatus::WaitingMerchant->value)
            ->where('last_support_message_at', '<=', $cutoff)
            ->get(['id', 'tenant_id']));

        foreach ($tickets as $row) {
            Tenancy::runAs($row->tenant_id, function () use ($row): void {
                $ticket = SupportTicket::query()->find($row->id);
                if ($ticket !== null && $ticket->status === SupportStatus::WaitingMerchant) {
                    $this->close($ticket, 'auto', null);
                }
            });
        }

        return $tickets->count();
    }

    /**
     * @param  list<UploadedFile>  $files
     */
    private function write(SupportTicket $ticket, string $sender, int $userId, ?string $body, array $files): SupportMessage
    {
        $body = $body === null ? null : (trim($body) === '' ? null : trim($body));
        if ($body === null && $files === []) {
            throw new ApiException(422, 'validation_failed', __('support.empty'), ['body' => [__('support.empty')]]);
        }
        $message = SupportMessage::query()->create(['support_ticket_id' => $ticket->id, 'sender' => $sender, 'user_id' => $userId, 'body' => $body]);
        $this->files->store($message, $files);

        $now = now();
        $updates = ['last_message_at' => $now];
        if ($sender === SupportMessage::SUPPORT) {
            $updates += ['last_support_message_at' => $now, 'support_read_at' => $now, 'status' => SupportStatus::WaitingMerchant];
            if ($ticket->first_response_at === null) {
                $updates['first_response_at'] = $now;
            }
        } else {
            $updates += ['last_merchant_message_at' => $now, 'merchant_read_at' => $now, 'status' => SupportStatus::WaitingSupport];
        }
        $ticket->forceFill($updates)->save();

        return $message->load('attachments');
    }

    private function system(SupportTicket $ticket, string $key): SupportMessage
    {
        $message = SupportMessage::query()->create(['support_ticket_id' => $ticket->id, 'sender' => SupportMessage::SYSTEM, 'body' => __('support.system.'.$key)]);
        $ticket->forceFill(['last_message_at' => now()])->save();

        return $message->load('attachments');
    }

    private function broadcast(SupportTicket $ticket, ?SupportMessage $message = null): void
    {
        try {
            $ticket->loadMissing('tenant:id,name');
            event(new SupportUpdated($ticket->tenant_id, $this->presenter->ticket($ticket, $message), $message ? $this->presenter->message($message) : null));
        } catch (Throwable $e) {
            // The realtime server being down never blocks support: the screens refresh on reconnect.
            Log::warning('support broadcast failed', ['ticket' => $ticket->id, 'error' => $e->getMessage()]);
        }
    }
}
