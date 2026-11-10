<?php

declare(strict_types=1);

namespace App\Billing\Payments;

use App\Billing\BillingPriceCalculator;
use App\Billing\PlanCatalog;
use App\Billing\PlanPriceQuote;
use App\Billing\PlatformSettings;
use App\Billing\SubscriptionManager;
use App\Enums\BillingPeriod;
use App\Enums\InvoiceStatus;
use App\Exceptions\ApiException;
use App\Models\Invoice;
use App\Models\Tenant;
use App\Support\Money;
use App\Tenancy\Tenancy;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

/**
 * Invoices for plan periods. The amount is fixed when the invoice is created (the upgrade
 * difference inside the first days, or the full price) and activation uses that snapshot.
 */
final class Invoices
{
    public function __construct(
        private readonly BillingPriceCalculator $prices,
        private readonly PlanCatalog $catalog,
        private readonly SubscriptionManager $subscriptions,
        private readonly PlatformSettings $settings,
    ) {}

    /** A new invoice for a plan period; other open invoices of the store are cancelled. */
    public function forPlan(Tenant $tenant, string $planKey, BillingPeriod $period): Invoice
    {
        $plan = $this->catalog->sellable()[$planKey] ?? null;
        $price = $plan === null ? null : $this->prices->planPrice($planKey, $period);
        if ($plan === null || $price === null) {
            throw new ApiException(422, 'plan_not_found', __('billing.plan_not_found'), ['plan_key' => [__('billing.plan_not_found')]]);
        }

        $quote = $this->prices->change($this->subscriptions->current($tenant), $price);
        $now = CarbonImmutable::now();

        $invoice = Tenancy::runAs($tenant->id, fn (): Invoice => DB::transaction(function () use ($tenant, $plan, $price, $quote, $period, $now): Invoice {
            // A receipt under review must be decided first (otherwise two periods could be paid).
            if (Invoice::query()->where('status', InvoiceStatus::PendingReview)->lockForUpdate()->exists()) {
                throw new ApiException(422, 'invoice_pending_review', __('payments.invoice_pending_review'));
            }

            // One open invoice per store at a time.
            Invoice::query()->whereIn('status', [InvoiceStatus::Open])->lockForUpdate()->get()
                ->each(fn (Invoice $old) => $old->forceFill(['status' => InvoiceStatus::Cancelled])->save());

            $invoice = Invoice::query()->create([
                'tenant_id' => $tenant->id,
                'type' => 'subscription',
                'plan_key' => $plan['key'],
                'period' => $period,
                'starts_now' => $quote->startsNow,
                'status' => InvoiceStatus::Open,
                'subtotal' => Money::toDecimal($price->originalCents),
                'discount' => Money::toDecimal($price->originalCents - $price->finalCents),
                'credit' => Money::toDecimal($quote->creditCents),
                'total' => Money::toDecimal($quote->payCents),
                'currency' => (string) config('landing.billing.currency'),
                'snapshot' => [
                    'plan' => ['key' => $plan['key'], 'name' => $plan['name']],
                    'price' => $price->toArray(),
                    'change' => $quote->toArray(),
                    'days' => $period->days(),
                ],
                'expires_at' => $now->addHours($this->settings->invoiceHours()),
            ]);
            $invoice->forceFill(['number' => sprintf('INV-%06d', $invoice->id)])->save();

            return $invoice;
        }));

        // Fully covered by the credit: nothing to transfer.
        if ($invoice->totalCents() === 0) {
            $this->activate($invoice);
        }

        return $invoice->refresh();
    }

    public function cancel(Invoice $invoice): Invoice
    {
        if (! $invoice->status->acceptsPayment()) {
            throw new ApiException(422, 'invoice_not_open', __('payments.invoice_not_open'));
        }
        $invoice->forceFill(['status' => InvoiceStatus::Cancelled])->save();

        return $invoice;
    }

    /**
     * Marks the invoice paid and starts the plan period, once: a second call (double approve,
     * a retry) finds it paid and does nothing.
     */
    public function activate(Invoice $invoice): Invoice
    {
        $tenant = Tenant::query()->findOrFail($invoice->tenant_id);

        $activated = Tenancy::runAs($tenant->id, fn (): ?Invoice => DB::transaction(function () use ($invoice): ?Invoice {
            $locked = Invoice::query()->whereKey($invoice->id)->lockForUpdate()->firstOrFail();
            if ($locked->status === InvoiceStatus::Paid || $locked->status === InvoiceStatus::Refunded) {
                return null;
            }
            $locked->forceFill(['status' => InvoiceStatus::Paid, 'paid_at' => now()])->save();

            return $locked;
        }));

        if ($activated === null) {
            return $invoice->refresh();
        }

        $snapshot = $activated->snapshot;
        $price = $snapshot['price'];
        $quote = new PlanPriceQuote(
            planKey: (string) $activated->plan_key,
            period: $activated->period ?? BillingPeriod::Monthly,
            originalCents: Money::toCents((string) $price['original']),
            discountPercent: (int) $price['discount_percent'],
            finalCents: Money::toCents((string) $price['final']),
            discountEndsAt: null,
        );

        $subscription = $this->subscriptions->subscribe($tenant, $quote, $activated->totalCents(), $activated->starts_now, ['invoice' => $activated->number], $activated->id);
        Tenancy::runAs($tenant->id, fn () => $activated->forceFill(['subscription_id' => $subscription->id])->save());

        return $activated->refresh();
    }

    /** Hourly: open invoices past their time stop taking receipts. */
    public function expireDue(): int
    {
        // Audited bypass: platform-wide housekeeping, filtered to open invoices past their time.
        return Tenancy::withoutTenant(fn (): int => Invoice::query()
            ->where('status', InvoiceStatus::Open)
            ->where('expires_at', '<=', now())
            ->update(['status' => InvoiceStatus::Expired]));
    }
}
