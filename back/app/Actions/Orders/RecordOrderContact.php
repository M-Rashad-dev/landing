<?php

declare(strict_types=1);

namespace App\Actions\Orders;

use App\Enums\ContactResult;
use App\Enums\OrderStatus;
use App\Exceptions\ApiException;
use App\Models\Order;
use App\Models\OrderEvent;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * Logs a contact attempt on a new order and schedules the next one:
 * no answer → try again in 2 hours, postponed → at the chosen time, WhatsApp → just logged.
 */
final class RecordOrderContact
{
    public const RETRY_AFTER_HOURS = 2;

    public function handle(Order $order, ContactResult $result, ?string $note, ?Carbon $followUpAt, ?int $userId): Order
    {
        if ($order->status !== OrderStatus::New) {
            throw new ApiException(422, 'contact_closed', __('orders.contact_closed'));
        }

        return DB::transaction(function () use ($order, $result, $note, $followUpAt, $userId): Order {
            $next = match ($result) {
                ContactResult::NoAnswer => now()->addHours(self::RETRY_AFTER_HOURS),
                ContactResult::Postponed => $followUpAt,
                ContactResult::Whatsapp => $order->follow_up_at,
            };

            $order->forceFill([
                'contact_attempts' => $result === ContactResult::NoAnswer ? $order->contact_attempts + 1 : $order->contact_attempts,
                'last_contacted_at' => now(),
                'follow_up_at' => $next,
            ])->save();

            OrderEvent::query()->create([
                'order_id' => $order->id,
                'user_id' => $userId,
                'type' => $result,
                'note' => $note,
                'follow_up_at' => $result === ContactResult::Whatsapp ? null : $next,
            ]);

            return $order;
        });
    }
}
