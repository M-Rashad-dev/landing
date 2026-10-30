<?php

declare(strict_types=1);

namespace App\Services\Webhooks;

use App\Models\AbandonedLead;
use App\Models\Order;
use App\Support\Money;

/** The JSON each event sends (stable field names; documented on the integrations screen). */
final class WebhookPayloads
{
    /** @return array<string, mixed> */
    public function order(Order $order): array
    {
        $order->loadMissing(['items', 'page:id,title,slug']);

        return ['order' => [
            'number' => $order->order_number,
            'status' => $order->status->value,
            'status_label' => $order->status->label(),
            'created_at' => $order->created_at?->toIso8601ZuluString(),
            'customer' => [
                'name' => $order->customer_name,
                'phone' => $order->customer_phone,
                'phone2' => $order->customer_phone2,
                'governorate' => $order->governorate,
                'city' => $order->city,
                'address' => $order->address,
                'notes' => $order->notes,
            ],
            'items' => $order->items->map(fn ($item) => [
                'product' => $item->product_name,
                'quantity' => (int) $item->quantity,
                'unit_price' => Money::toFloat(Money::toCents((string) $item->unit_price)),
                'total' => Money::toFloat(Money::toCents((string) $item->line_total)),
                'options' => collect($item->options ?? [])->map(fn ($o) => ['name' => $o['option'] ?? null, 'value' => $o['value'] ?? null])->values()->all(),
            ])->values()->all(),
            'quantity' => (int) $order->quantity,
            'subtotal' => Money::toFloat(Money::toCents((string) $order->subtotal)),
            'discount' => Money::toFloat(Money::toCents((string) $order->offer_discount) + Money::toCents((string) $order->code_discount)),
            'discount_code' => $order->discount_code,
            'shipping' => Money::toFloat(Money::toCents((string) $order->shipping_fee)),
            'total' => Money::toFloat(Money::toCents((string) $order->total)),
            'currency' => $order->currency,
            'answers' => $order->answers ?? (object) [],
            'page' => $order->page ? ['title' => $order->page->title, 'slug' => $order->page->slug] : null,
            'utm' => $order->utm ?? (object) [],
        ]];
    }

    /** @return array<string, mixed> */
    public function lead(AbandonedLead $lead): array
    {
        $lead->loadMissing(['product:id,name', 'page:id,title,slug']);

        return ['lead' => [
            'id' => $lead->id,
            'name' => $lead->customer_name,
            'phone' => $lead->customer_phone,
            'governorate' => $lead->governorate,
            'quantity' => $lead->quantity,
            'product' => $lead->product?->name,
            'page' => $lead->page ? ['title' => $lead->page->title, 'slug' => $lead->page->slug] : null,
            'created_at' => $lead->created_at->toIso8601ZuluString(),
        ]];
    }

    /** Sample order for the "send test" button (clearly marked as a test). */
    public function sample(): array
    {
        return ['test' => true, 'message' => 'رسالة تجربة من المنصة — لو وصلتك يبقى الربط شغال.', 'order' => [
            'number' => 0,
            'status' => 'new',
            'status_label' => 'جديد',
            'created_at' => now()->toIso8601ZuluString(),
            'customer' => ['name' => 'تجربة', 'phone' => '+201000000000', 'phone2' => null, 'governorate' => 'القاهرة', 'city' => null, 'address' => 'عنوان تجربة', 'notes' => null],
            'items' => [['product' => 'منتج تجربة', 'quantity' => 1, 'unit_price' => 100.0, 'total' => 100.0, 'options' => []]],
            'quantity' => 1,
            'subtotal' => 100.0,
            'discount' => 0.0,
            'discount_code' => null,
            'shipping' => 0.0,
            'total' => 100.0,
            'currency' => 'EGP',
            'answers' => (object) [],
            'page' => null,
            'utm' => (object) [],
        ]];
    }
}
