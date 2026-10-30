<?php

declare(strict_types=1);

namespace App\Actions\Orders;

use App\Enums\LeadStatus;
use App\Models\AbandonedLead;
use App\Models\BlockedCustomer;
use App\Models\LandingPage;
use App\Models\Order;

/**
 * Keeps one open lead per phone and page while the visitor fills the order form,
 * and closes it when that phone orders.
 */
final class CaptureLead
{
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

        AbandonedLead::query()->create($values + [
            'landing_page_id' => $page->id,
            'product_id' => $page->product_id,
            'customer_phone' => $phone,
            'status' => LeadStatus::Open,
            'last_seen_at' => now(),
        ]);
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
