<?php

declare(strict_types=1);

namespace App\Billing\Payments;

use App\Actions\Admin\ManageTenant;
use App\Billing\PlatformSettings;
use App\Enums\InvoiceStatus;
use App\Enums\PaymentStatus;
use App\Exceptions\ApiException;
use App\Models\Invoice;
use App\Models\Payment;
use App\Models\PaymentMethod;
use App\Tenancy\Tenancy;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Throwable;

/**
 * Transfer + receipt → the platform owner approves (the plan starts) or rejects with a
 * written reason (the merchant sees it and can send a new receipt for the same invoice).
 */
final class ManualPayments
{
    public function __construct(
        private readonly ReceiptStore $receipts,
        private readonly Invoices $invoices,
        private readonly ManageTenant $audit,
        private readonly PlatformSettings $settings,
    ) {}

    /** Runs in the merchant's tenant context. */
    public function submit(Invoice $invoice, string $methodKey, string $senderRef, UploadedFile $receipt): Payment
    {
        $method = PaymentMethod::query()->usable()->where('kind', 'manual')->find($methodKey)
            ?? throw new ApiException(422, 'validation_failed', __('payments.method_unavailable'), ['method' => [__('payments.method_unavailable')]]);

        if (! $invoice->isPayable()) {
            throw new ApiException(422, 'invoice_not_open', __('payments.invoice_not_open'));
        }

        $path = $this->receipts->store($receipt, $invoice->tenant_id);

        try {
            return DB::transaction(function () use ($invoice, $method, $senderRef, $path): Payment {
                $locked = Invoice::query()->whereKey($invoice->id)->lockForUpdate()->firstOrFail();
                if (! $locked->isPayable()) {
                    throw new ApiException(422, 'invoice_not_open', __('payments.invoice_not_open'));
                }

                $payment = Payment::query()->create([
                    'invoice_id' => $locked->id,
                    'method_key' => $method->key,
                    // The invoice total: a transfer is for the whole amount (partial ones are rejected with a reason).
                    'amount' => $locked->total,
                    'sender_ref' => $senderRef,
                    'receipt_path' => $path,
                    'status' => PaymentStatus::PendingReview,
                ]);
                $locked->forceFill(['status' => InvoiceStatus::PendingReview])->save();

                return $payment;
            });
        } catch (Throwable $e) {
            $this->receipts->delete($path);

            throw $e;
        }
    }

    /** Super admin. */
    public function approve(Payment $payment, ?int $adminId): Payment
    {
        $payment = $this->decide($payment, PaymentStatus::Approved, null, $adminId);
        $invoice = Tenancy::runAs($payment->tenant_id, fn () => Invoice::query()->findOrFail($payment->invoice_id));
        $this->invoices->activate($invoice);
        $this->audit->audit('payment.approve', (string) $payment->id, ['invoice' => $invoice->number, 'tenant_id' => $payment->tenant_id, 'amount' => $payment->amount], 'payment');

        return $payment;
    }

    /** Super admin; the reason is required and shown to the merchant. */
    public function reject(Payment $payment, string $reason, ?int $adminId): Payment
    {
        $payment = $this->decide($payment, PaymentStatus::Rejected, $reason, $adminId);
        $this->audit->audit('payment.reject', (string) $payment->id, ['tenant_id' => $payment->tenant_id, 'reason' => $reason], 'payment');

        return $payment;
    }

    private function decide(Payment $payment, PaymentStatus $status, ?string $reason, ?int $adminId): Payment
    {
        return Tenancy::runAs($payment->tenant_id, fn (): Payment => DB::transaction(function () use ($payment, $status, $reason, $adminId): Payment {
            $locked = Payment::query()->whereKey($payment->id)->lockForUpdate()->firstOrFail();
            if ($locked->status !== PaymentStatus::PendingReview) {
                throw ApiException::conflict('payment_already_reviewed', __('payments.already_reviewed'));
            }

            $locked->forceFill([
                'status' => $status,
                'reviewed_by' => $adminId,
                'reviewed_at' => now(),
                'reject_reason' => $reason,
            ])->save();

            if ($status === PaymentStatus::Rejected) {
                // Back to open: the merchant can send a new receipt (even if the invoice time passed meanwhile).
                Invoice::query()->whereKey($locked->invoice_id)->where('status', InvoiceStatus::PendingReview)
                    ->update(['status' => InvoiceStatus::Open, 'expires_at' => now()->addHours($this->settings->invoiceHours())]);
            }

            return $locked;
        }));
    }
}
