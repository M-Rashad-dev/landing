<?php

declare(strict_types=1);

namespace App\Actions\Orders;

use App\Enums\BlockType;
use App\Enums\OrderStatus;
use App\Models\BlockedCustomer;
use App\Models\Customer;
use App\Models\Order;
use App\Models\OrderItem;
use Illuminate\Database\Eloquent\Builder;

/**
 * Blocks a phone automatically (config landing.auto_block, rules per source: landing pages or the store):
 * - same_in_row: the last N orders of the phone are the same products, all within the window;
 * - per_day: N orders in one Cairo day;
 * - returns: at least N returned orders that are more than X % of its orders (cancelled ones not counted).
 * The order that meets a rule is kept; the next ones are refused like any blocked phone.
 * A customer the merchant unblocked is never blocked automatically again.
 */
final class AutoBlock
{
    public const SAME_IN_ROW = 'same_in_row';

    public const PER_DAY = 'per_day';

    public const RETURNS = 'returns';

    /** After a new order (outside its transaction). */
    public function afterOrder(Order $order): void
    {
        if ($this->exempt($order)) {
            return;
        }
        $rules = $this->rules($order);
        $mine = fn () => $this->sameSource(Order::query()->where('customer_phone', $order->customer_phone), $order);

        $tz = (string) config('landing.display_timezone');
        $dayStart = now($tz)->startOfDay()->utc();
        $today = $mine()->where('created_at', '>=', $dayStart)->count();
        if ($today >= $rules['per_day']) {
            $this->block($order, self::PER_DAY, __('orders.auto_block_per_day', ['count' => $today]));

            return;
        }

        $last = $mine()->where('created_at', '>=', now()->subHours((int) config('landing.auto_block.window_hours', 24)))
            ->with('items:id,order_id,product_id,quantity,is_gift')
            ->orderByDesc('order_number')
            ->limit($rules['same_in_row'])
            ->get();
        if ($last->count() >= $rules['same_in_row'] && $last->map(fn (Order $o) => $this->signature($o))->unique()->count() === 1) {
            $this->block($order, self::SAME_IN_ROW, __('orders.auto_block_same_in_row', ['count' => $last->count()]));
        }
    }

    /** After an order became returned. */
    public function afterReturn(Order $order): void
    {
        if ($this->exempt($order)) {
            return;
        }
        $rules = $this->rules($order);
        $counts = $this->sameSource(Order::query()->where('customer_phone', $order->customer_phone), $order)
            ->where('status', '!=', OrderStatus::Cancelled->value)
            ->selectRaw('status, count(*) as aggregate')->groupBy('status')->pluck('aggregate', 'status');
        $total = (int) $counts->sum();
        $returned = (int) ($counts[OrderStatus::Returned->value] ?? 0);

        if ($returned >= $rules['returns_min'] && $total > 0 && $returned * 100 > $rules['returns_ratio'] * $total) {
            $this->block($order, self::RETURNS, __('orders.auto_block_returns', ['returned' => $returned, 'total' => $total]));
        }
    }

    /**
     * Store orders, or landing-page orders (every other source).
     *
     * @param  Builder<Order>  $query
     * @return Builder<Order>
     */
    private function sameSource(Builder $query, Order $order): Builder
    {
        return $order->source === 'store' ? $query->where('source', 'store') : $query->where('source', '!=', 'store');
    }

    /** @return array{same_in_row: int, per_day: int, returns_min: int, returns_ratio: int} */
    private function rules(Order $order): array
    {
        $key = $order->source === 'store' ? 'store' : 'landing';

        return array_map('intval', (array) config("landing.auto_block.{$key}"));
    }

    private function exempt(Order $order): bool
    {
        return Customer::query()->where('phone', $order->customer_phone)->where('block_exempt', true)->exists()
            || BlockedCustomer::query()->where('type', BlockType::Phone)->where('value', $order->customer_phone)->exists();
    }

    /** The products of an order (gifts aside), whatever their order in the cart or quantities. */
    private function signature(Order $order): string
    {
        $items = $order->items->reject(fn (OrderItem $i) => (bool) $i->is_gift)->map(fn (OrderItem $i) => (string) $i->product_id)->unique()->sort()->values()->all();

        return $items === [] ? 'p'.$order->product_id : implode(',', $items);
    }

    private function block(Order $order, string $rule, string $reason): void
    {
        BlockedCustomer::query()->firstOrCreate(
            ['type' => BlockType::Phone, 'value' => $order->customer_phone],
            ['reason' => mb_substr($reason, 0, 200), 'rule' => $rule],
        );
    }
}
