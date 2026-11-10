<?php

declare(strict_types=1);

namespace App\Billing\Payments;

use App\Actions\Admin\ManageTenant;
use App\Billing\SubscriptionManager;
use App\Enums\InvoiceStatus;
use App\Exceptions\ApiException;
use App\Models\Invoice;
use App\Models\Subscription;
use App\Models\Tenant;
use App\Tenancy\Tenancy;
use Illuminate\Support\Facades\DB;

/**
 * Plan refunds (docs: within 3 days of a paid period, once per 180 days; themes never).
 * The merchant asks; the platform owner sends the money back manually and records it,
 * which ends the period at once.
 */
final class Refunds
{
    public function __construct(
        private readonly SubscriptionManager $subscriptions,
        private readonly ManageTenant $audit,
    ) {}

    /** The paid invoice that can be refunded now, or null. */
    public function refundableInvoice(Tenant $tenant): ?Invoice
    {
        $subscription = $this->subscriptions->refundable($tenant);
        if ($subscription?->invoice_id === null) {
            return null;
        }

        return Tenancy::runAs($tenant->id, fn () => Invoice::query()
            ->whereKey($subscription->invoice_id)
            ->where('status', InvoiceStatus::Paid)
            ->whereNull('refund_requested_at')
            ->first());
    }

    public function request(Tenant $tenant, string $reason): Invoice
    {
        $invoice = $this->refundableInvoice($tenant) ?? throw new ApiException(422, 'refund_not_allowed', __('payments.refund_not_allowed'));
        $invoice->forceFill(['refund_requested_at' => now(), 'refund_reason' => $reason])->save();

        return $invoice;
    }

    /** Super admin: the money went back (refund_ref = the transfer reference). */
    public function complete(Invoice $invoice, string $refundRef, ?int $adminId): Invoice
    {
        $tenant = Tenant::query()->findOrFail($invoice->tenant_id);

        $invoice = Tenancy::runAs($tenant->id, fn (): Invoice => DB::transaction(function () use ($invoice, $refundRef): Invoice {
            $locked = Invoice::query()->whereKey($invoice->id)->lockForUpdate()->firstOrFail();
            if ($locked->status !== InvoiceStatus::Paid || $locked->refund_requested_at === null) {
                throw ApiException::conflict('refund_not_requested', __('payments.refund_not_requested'));
            }
            $locked->forceFill(['status' => InvoiceStatus::Refunded, 'refunded_at' => now(), 'refund_ref' => $refundRef])->save();

            return $locked;
        }));

        $subscription = Tenancy::runAs($tenant->id, fn () => Subscription::query()->find($invoice->subscription_id));
        if ($subscription !== null) {
            $this->subscriptions->markRefunded($tenant, $subscription);
        }
        $this->audit->audit('invoice.refund', $tenant, ['invoice' => $invoice->number, 'refund_ref' => $refundRef]);

        return $invoice;
    }
}
