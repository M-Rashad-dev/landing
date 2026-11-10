<?php

declare(strict_types=1);

namespace App\Billing\Payments;

use App\Billing\BillingPriceCalculator;
use App\Billing\Entitlements;
use App\Billing\PlanCatalog;
use App\Billing\PlanPriceQuote;
use App\Billing\PlatformSettings;
use App\Billing\SubscriptionManager;
use App\Billing\Themes\ThemeAccess;
use App\Billing\Themes\ThemeCatalog;
use App\Enums\BillingPeriod;
use App\Enums\InvoiceStatus;
use App\Enums\PlanFeature;
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
        private readonly ThemeCatalog $themes,
        private readonly ThemeAccess $access,
        private readonly Entitlements $entitlements,
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
            if (Invoice::query()->where('type', 'subscription')->where('status', InvoiceStatus::PendingReview)->lockForUpdate()->exists()) {
                throw new ApiException(422, 'invoice_pending_review', __('payments.invoice_pending_review'));
            }

            // One open plan invoice per store at a time (theme invoices are separate).
            Invoice::query()->where('type', 'subscription')->where('status', InvoiceStatus::Open)->lockForUpdate()->get()
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

    /**
     * An invoice for a paid theme (bought once, owned forever). Needs a plan with "buy_themes"
     * (and the theme's minimum plan, when set); a theme already owned or free is refused.
     */
    public function forTheme(Tenant $tenant, string $themeKey): Invoice
    {
        $theme = $this->themes->theme($themeKey);
        $price = $this->prices->themePrice($themeKey);
        if ($theme === null || $price === null || ! $theme['is_listed'] || ! $theme['is_active']) {
            throw new ApiException(404, 'not_found', __('landing.not_found'));
        }
        if ($price->isFree() || $this->access->owns($tenant, $themeKey)) {
            throw new ApiException(422, 'theme_owned', __('themes.already_owned'));
        }

        Entitlements::forget($tenant->id);
        $plan = $this->entitlements->for($tenant);
        $minRank = $theme['min_plan_key'] === null ? null : $this->catalog->rank($theme['min_plan_key']);
        if (! $plan->allows(PlanFeature::BuyThemes) || ($minRank !== null && ($plan->planKey === null || $this->catalog->rank($plan->planKey) < $minRank))) {
            $needed = $theme['min_plan_key'] === null ? $this->catalog->cheapestWithFeature(PlanFeature::BuyThemes) : ['key' => $theme['min_plan_key'], 'name' => $this->catalog->plan($theme['min_plan_key'])['name'] ?? $theme['min_plan_key']];
            throw ApiException::planFeatureLocked(PlanFeature::BuyThemes, $needed);
        }

        $now = CarbonImmutable::now();

        $invoice = Tenancy::runAs($tenant->id, fn (): Invoice => DB::transaction(function () use ($tenant, $theme, $price, $now): Invoice {
            $same = Invoice::query()->where('type', 'theme')->where('theme_key', $theme['key'])->lockForUpdate();
            if ((clone $same)->where('status', InvoiceStatus::PendingReview)->exists()) {
                throw new ApiException(422, 'invoice_pending_review', __('payments.invoice_pending_review'));
            }
            (clone $same)->where('status', InvoiceStatus::Open)->get()
                ->each(fn (Invoice $old) => $old->forceFill(['status' => InvoiceStatus::Cancelled])->save());

            $invoice = Invoice::query()->create([
                'tenant_id' => $tenant->id,
                'type' => 'theme',
                'theme_key' => $theme['key'],
                'starts_now' => true,
                'status' => InvoiceStatus::Open,
                'subtotal' => Money::toDecimal($price->originalCents),
                'discount' => Money::toDecimal($price->originalCents - $price->finalCents),
                'credit' => Money::toDecimal(0),
                'total' => Money::toDecimal($price->finalCents),
                'currency' => (string) config('landing.billing.currency'),
                'snapshot' => ['theme' => ['key' => $theme['key'], 'name' => $theme['name']], 'price' => $price->toArray()],
                'expires_at' => $now->addHours($this->settings->invoiceHours()),
            ]);
            $invoice->forceFill(['number' => sprintf('INV-%06d', $invoice->id)])->save();

            return $invoice;
        }));

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

        if ($activated->type === 'theme') {
            $this->access->grant($tenant, (string) $activated->theme_key, 'purchase', $activated->id, $activated->totalCents());

            return $activated->refresh();
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
