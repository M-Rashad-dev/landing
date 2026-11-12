<?php

declare(strict_types=1);

namespace App\Store\Accounts;

use App\Enums\OrderStatus;
use App\Models\Customer;
use App\Models\Media;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\OrderStatusLog;
use App\Models\ProductReview;
use App\Support\Money;
use Illuminate\Pagination\LengthAwarePaginator;

/**
 * «طلباتي»: a signed-in customer's orders (every order on their phone, guest ones included), in
 * the words the customer reads (stages, not internal statuses). Runs inside the store's tenant context.
 */
final class CustomerOrders
{
    /** @return LengthAwarePaginator<int, Order> */
    public function page(Customer $customer, int $page): LengthAwarePaginator
    {
        return Order::query()->where('customer_id', $customer->id)->with('items')->latest('id')->paginate(10, ['*'], 'page', $page);
    }

    /** @return array<string, mixed> */
    public function row(Order $order): array
    {
        $items = $order->items->where('is_gift', false);

        return [
            'order_number' => $order->order_number,
            'created_at' => $order->created_at->toIso8601ZuluString(),
            'stage' => $order->status->customerStage(),
            'total' => Money::toFloat(Money::toCents((string) $order->total)),
            'items_count' => (int) $items->sum('quantity'),
            // The first product names (the list shows them; the order page has the full lines).
            'products' => $items->take(3)->pluck('product_name')->values()->all(),
        ];
    }

    public function find(Customer $customer, int $number): ?Order
    {
        return Order::query()->where('customer_id', $customer->id)->where('order_number', $number)
            ->with(['items.product.media', 'logs'])->first();
    }

    /** @return array<string, mixed> */
    public function detail(Customer $customer, Order $order): array
    {
        $delivered = $order->status === OrderStatus::Delivered;
        $reviews = ProductReview::query()->where('customer_id', $customer->id)
            ->whereIn('product_id', $order->items->pluck('product_id')->filter()->all())
            ->get()->keyBy('product_id');

        return [
            ...$this->row($order),
            'history' => self::history($order),
            'items' => $order->items->map(function (OrderItem $item) use ($delivered, $reviews) {
                $product = $item->product;
                $live = $product !== null && ! $product->trashed() && $product->is_active && $product->in_store;
                /** @var Media|null $image */
                $image = $product?->media->first();
                $review = $item->product_id === null ? null : $reviews->get($item->product_id);

                return [
                    'product_id' => $item->product_id,
                    'name' => $item->product_name,
                    'slug' => $live ? $product->slug : null,
                    'image' => $image?->urls(),
                    'options' => array_values(array_map(fn ($o) => (string) ($o['value'] ?? ''), $item->options ?? [])),
                    'quantity' => $item->quantity,
                    'total' => Money::toFloat(Money::toCents((string) $item->line_total)),
                    'is_gift' => $item->is_gift,
                    'can_review' => $delivered && $product !== null && ! $product->trashed(),
                    'review' => $review === null ? null : ['rating' => $review->rating, 'text' => $review->text],
                ];
            })->values()->all(),
            'subtotal' => Money::toFloat(Money::toCents((string) $order->subtotal)),
            'discount' => Money::toFloat(Money::toCents((string) $order->offer_discount) + Money::toCents((string) $order->code_discount)),
            'shipping_fee' => Money::toFloat(Money::toCents((string) $order->shipping_fee)),
            'customer_name' => $order->customer_name,
            'governorate' => $order->governorate,
            'city' => $order->city,
            'address' => $order->address,
            'shipping_company' => $order->shipping_company_name,
            'tracking_number' => $order->tracking_number,
        ];
    }

    /**
     * Each stage the order went through, once, with its time.
     *
     * @return list<array{stage: string, at: string}>
     */
    public static function history(Order $order): array
    {
        $history = [];
        foreach ($order->logs as $log) {
            /** @var OrderStatusLog $log */
            $stage = $log->to_status->customerStage();
            if (($history[array_key_last($history) ?? -1]['stage'] ?? null) !== $stage) {
                $history[] = ['stage' => $stage, 'at' => $log->created_at->toIso8601ZuluString()];
            }
        }

        return $history;
    }
}
