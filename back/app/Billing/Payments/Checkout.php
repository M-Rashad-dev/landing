<?php

declare(strict_types=1);

namespace App\Billing\Payments;

use App\Enums\BillingPeriod;
use App\Models\Invoice;
use App\Models\Tenant;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Buying a plan period or a paid theme. Opening the pay page is only a look (a draft, nothing
 * saved); the invoice is created together with the merchant's receipt, so the invoices list
 * only holds what was really paid for. A plan fully covered by the credit has nothing to
 * transfer: confirming creates and activates it at once.
 */
final class Checkout
{
    public function __construct(
        private readonly Invoices $invoices,
        private readonly ManualPayments $payments,
    ) {}

    /** @param array{type: string, plan_key?: string|null, period?: string|null, theme_key?: string|null} $item */
    public function preview(Tenant $tenant, array $item): Invoice
    {
        return $item['type'] === 'theme'
            ? $this->invoices->draftTheme($tenant, (string) $item['theme_key'])
            : $this->invoices->draftPlan($tenant, (string) $item['plan_key'], BillingPeriod::from((string) $item['period']));
    }

    /** @param array{type: string, plan_key?: string|null, period?: string|null, theme_key?: string|null} $item */
    public function place(Tenant $tenant, array $item, ?string $method, ?string $senderRef, ?UploadedFile $receipt): Invoice
    {
        $draft = $this->preview($tenant, $item);

        if ($draft->totalCents() > 0) {
            $missing = array_filter([
                'method' => $method === null || $method === '' ? [__('validation.required', ['attribute' => 'method'])] : null,
                'sender_ref' => $senderRef === null || mb_strlen($senderRef) < 3 ? [__('validation.required', ['attribute' => 'sender_ref'])] : null,
                'receipt' => $receipt === null ? [__('validation.required', ['attribute' => 'receipt'])] : null,
            ]);
            if ($missing !== []) {
                throw ValidationException::withMessages($missing);
            }
        }

        // The invoice and its receipt are one step: a refused receipt leaves no invoice behind.
        return DB::transaction(function () use ($tenant, $item, $method, $senderRef, $receipt): Invoice {
            $invoice = $item['type'] === 'theme'
                ? $this->invoices->forTheme($tenant, (string) $item['theme_key'])
                : $this->invoices->forPlan($tenant, (string) $item['plan_key'], BillingPeriod::from((string) $item['period']));

            if ($invoice->totalCents() > 0 && $receipt !== null) {
                $this->payments->submit($invoice, (string) $method, (string) $senderRef, $receipt);
            }

            return $invoice->refresh();
        });
    }
}
