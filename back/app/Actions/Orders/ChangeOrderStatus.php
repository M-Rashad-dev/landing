<?php

declare(strict_types=1);

namespace App\Actions\Orders;

use App\Enums\BlockType;
use App\Enums\OrderStatus;
use App\Enums\WebhookEvent;
use App\Exceptions\ApiException;
use App\Models\BlockedCustomer;
use App\Models\DiscountCode;
use App\Models\DiscountCodeRedemption;
use App\Models\Order;
use App\Services\Webhooks\WebhookDispatcher;
use App\Store\Stock;
use Illuminate\Support\Facades\DB;

/**
 * Applies one transition of the 7.4 table with its effects, atomically:
 * status log, released code use (fake/cancelled), optional phone/IP block (fake).
 * Reopening does not consume the code again (documented limitation).
 */
final class ChangeOrderStatus
{
    public function __construct(private readonly WebhookDispatcher $webhooks, private readonly Stock $stock) {}

    /** @param array{block_phone?: bool, block_ip?: bool} $options */
    public function handle(Order $order, OrderStatus $to, ?string $note, ?int $userId, array $options = []): Order
    {
        $from = $order->status;
        $changed = DB::transaction(function () use ($order, $to, $note, $userId, $options) {
            /** @var Order $locked */
            $locked = Order::query()->whereKey($order->id)->lockForUpdate()->firstOrFail();
            $from = $locked->status;

            if (! $from->canTransitionTo($to)) {
                throw new ApiException(422, 'transition_not_allowed', __('orders.transition_not_allowed', ['from' => $from->label(), 'to' => $to->label()]));
            }

            // A scheduled callback only matters while the order is new.
            $locked->forceFill(['status' => $to, 'status_changed_at' => now(), 'follow_up_at' => $to === OrderStatus::New ? $locked->follow_up_at : null])->save();
            $locked->logs()->create([
                'from_status' => $from,
                'to_status' => $to,
                'note' => $note === null || trim($note) === '' ? null : mb_substr(trim(strip_tags($note)), 0, 500),
                'changed_by' => $userId,
            ]);

            if ($to->releasesCode()) {
                $this->releaseCode($locked);
            }
            // Cancelled, fake and returned orders give their units back (once).
            if ($to->restocks()) {
                $this->stock->restock($locked);
            }

            if ($to === OrderStatus::Fake) {
                $reason = __('orders.blocked_from_order', ['number' => $locked->order_number]);
                if (($options['block_phone'] ?? false) === true) {
                    BlockedCustomer::query()->firstOrCreate(['type' => BlockType::Phone, 'value' => $locked->customer_phone], ['reason' => $reason]);
                }
                if (($options['block_ip'] ?? false) === true && $locked->ip_address !== null) {
                    BlockedCustomer::query()->firstOrCreate(['type' => BlockType::Ip, 'value' => $locked->ip_address], ['reason' => $reason]);
                }
            }

            return $locked;
        });

        $this->webhooks->order(WebhookEvent::OrderStatusChanged, $changed, ['previous_status' => $from->value]);

        return $changed;
    }

    private function releaseCode(Order $order): void
    {
        $redemption = DiscountCodeRedemption::query()->where('order_id', $order->id)->whereNull('released_at')->lockForUpdate()->first();

        if ($redemption === null) {
            return;
        }

        $code = DiscountCode::query()->whereKey($redemption->discount_code_id)->lockForUpdate()->first();
        $redemption->forceFill(['released_at' => now()])->save();

        if ($code !== null && $code->used_count > 0) {
            $code->decrement('used_count');
        }
    }
}
