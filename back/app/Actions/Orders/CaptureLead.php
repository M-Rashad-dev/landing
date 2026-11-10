<?php

declare(strict_types=1);

namespace App\Actions\Orders;

use App\Enums\LeadStatus;
use App\Models\AbandonedLead;
use App\Models\BlockedCustomer;
use App\Models\LandingPage;
use App\Models\Order;
use App\Services\Webhooks\WebhookDispatcher;

/**
 * Keeps one open lead per phone and page while the visitor fills the order form,
 * and closes it when that phone orders.
 */
final class CaptureLead
{
    public function __construct(private readonly WebhookDispatcher $webhooks) {}

    /** Leads older than this are deleted (privacy). */
    public const KEEP_DAYS = 30;

    /** @param array{name?: string|null, governorate?: string|null, quantity?: int|null, ip?: string|null} $details */
    public function capture(LandingPage $page, string $phone, array $details): void
    {
        if (BlockedCustomer::isBlocked($phone, $details['ip'] ?? null)) {
            return;
        }

        // Already ordered from this page today → nothing to recover.
        $ordered = Order::query()->where('customer_phone', $phone)->where('landing_page_id', $page->id)->where('created_at', '>=', now()->subDay())->exists();
        if ($ordered) {
            return;
        }

        $values = array_filter([
            'customer_name' => $details['name'] ?? null,
            'governorate' => $details['governorate'] ?? null,
            'quantity' => $details['quantity'] ?? null,
            'ip_address' => $details['ip'] ?? null,
        ], fn ($value) => $value !== null && $value !== '');

        $lead = AbandonedLead::query()->where('customer_phone', $phone)->where('landing_page_id', $page->id)->where('status', LeadStatus::Open)->first();
        if ($lead !== null) {
            $lead->fill($values + ['last_seen_at' => now()])->save();

            return;
        }

        $lead = AbandonedLead::query()->create($values + [
            'landing_page_id' => $page->id,
            'product_id' => $page->product_id,
            'customer_phone' => $phone,
            'status' => LeadStatus::Open,
            'last_seen_at' => now(),
        ]);
        $this->webhooks->lead($lead);
    }

    /**
     * A store checkout left after typing the phone: one open lead per phone with the cart
     * (product names, quantities, total) for the follow-up call.
     *
     * @param  array{name?: string|null, governorate?: string|null, ip?: string|null}  $details
     * @param  array{items: list<array{product_id: int, name: string, quantity: int}>, total: float}  $cart
     */
    public function captureCart(string $phone, array $details, array $cart): void
    {
        if (BlockedCustomer::isBlocked($phone, $details['ip'] ?? null)) {
            return;
        }
        if (Order::query()->where('customer_phone', $phone)->where('source', 'store')->where('created_at', '>=', now()->subDay())->exists()) {
            return;
        }

        $values = array_filter([
            'customer_name' => $details['name'] ?? null,
            'governorate' => $details['governorate'] ?? null,
            'ip_address' => $details['ip'] ?? null,
        ], fn ($value) => $value !== null && $value !== '') + [
            'cart' => $cart,
            'quantity' => max(1, min(65535, array_sum(array_column($cart['items'], 'quantity')))),
            'product_id' => $cart['items'][0]['product_id'] ?? null,
            'last_seen_at' => now(),
        ];

        $lead = AbandonedLead::query()->where('customer_phone', $phone)->where('source', 'store')->where('status', LeadStatus::Open)->first();
        if ($lead !== null) {
            $lead->fill($values)->save();

            return;
        }

        $lead = AbandonedLead::query()->create($values + ['source' => 'store', 'customer_phone' => $phone, 'status' => LeadStatus::Open]);
        $this->webhooks->lead($lead);
    }

    /** The phone ordered: its open / contacted leads become converted. */
    public function converted(Order $order): void
    {
        AbandonedLead::query()
            ->where('customer_phone', $order->customer_phone)
            ->whereIn('status', [LeadStatus::Open, LeadStatus::Contacted])
            ->update(['status' => LeadStatus::Converted, 'order_id' => $order->id, 'updated_at' => now()]);
    }
}
