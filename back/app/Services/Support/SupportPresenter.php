<?php

declare(strict_types=1);

namespace App\Services\Support;

use App\Enums\SupportStatus;
use App\Models\SupportAttachment;
use App\Models\SupportMessage;
use App\Models\SupportTicket;

/**
 * The JSON shapes of the support chat, the same for the store, the admin and the realtime events.
 * Support replies are "support", never an admin's name.
 */
final class SupportPresenter
{
    /** @return array<string, mixed> */
    public function ticket(SupportTicket $ticket, ?SupportMessage $last = null): array
    {
        $idle = (int) config('landing.support.idle_hours');

        return [
            'number' => $ticket->number,
            'topic' => $ticket->topic->value,
            'status' => $ticket->status->value,
            'close_reason' => $ticket->close_reason,
            'store' => ['id' => $ticket->tenant_id, 'name' => $ticket->relationLoaded('tenant') ? $ticket->tenant?->name : null],
            'created_at' => $ticket->created_at?->toIso8601ZuluString(),
            'last_message_at' => $ticket->last_message_at?->toIso8601ZuluString(),
            'closed_at' => $ticket->closed_at?->toIso8601ZuluString(),
            // When a conversation waiting for the merchant will close by itself.
            'closes_at' => $ticket->status === SupportStatus::WaitingMerchant && $ticket->last_support_message_at !== null
                ? $ticket->last_support_message_at->copy()->addHours($idle)->toIso8601ZuluString()
                : null,
            'merchant_read_at' => $ticket->merchant_read_at?->toIso8601ZuluString(),
            'support_read_at' => $ticket->support_read_at?->toIso8601ZuluString(),
            'unread_merchant' => $ticket->unreadForMerchant(),
            'unread_support' => $ticket->unreadForSupport(),
            'rating' => $ticket->rating,
            'rating_resolved' => $ticket->rating_resolved,
            'rating_comment' => $ticket->rating_comment,
            'reopened_count' => $ticket->reopened_count,
            'last_message' => $last === null ? null : [
                'sender' => $last->sender,
                'preview' => mb_substr((string) $last->body, 0, 120),
                'files' => $last->relationLoaded('attachments') ? $last->attachments->count() : 0,
            ],
        ];
    }

    /** @return array<string, mixed> */
    public function message(SupportMessage $message): array
    {
        return [
            'id' => $message->id,
            'sender' => $message->sender,
            'body' => $message->body,
            'created_at' => $message->created_at?->toIso8601ZuluString(),
            'attachments' => $message->attachments->map(fn (SupportAttachment $a) => [
                'id' => $a->id,
                'kind' => $a->kind,
                'name' => $a->name,
                'mime' => $a->mime,
                'size' => $a->size,
            ])->values()->all(),
        ];
    }
}
