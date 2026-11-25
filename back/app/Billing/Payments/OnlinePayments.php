<?php

declare(strict_types=1);

namespace App\Billing\Payments;

use App\Billing\Payments\XPay\XPayClient;
use App\Billing\Payments\XPay\XPayError;
use App\Enums\PaymentStatus;
use App\Exceptions\ApiException;
use App\Models\Invoice;
use App\Models\OnlinePayment;
use App\Models\Payment;
use App\Models\PaymentMethod;
use App\Notifications\StoreNotices;
use App\Services\PublicSite;
use App\Support\Money;
use App\Tenancy\Tenancy;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

/**
 * Paying a platform invoice online (XPay hosted checkout): open a session and send the merchant to XPay's page, then
 * settle it from what XPay says the session is now (never from the browser's redirect or the webhook body alone): paid
 * → a payment row (approved, no receipt) and the invoice activated, once; a pay-later method (Fawry) waits for its
 * money; an expired session just closes. The money goes to the platform's own XPay account.
 */
final class OnlinePayments
{
    public function __construct(
        private readonly XPayClient $client,
        private readonly PaymentGateways $gateways,
        private readonly Invoices $invoices,
        private readonly StoreNotices $notices,
    ) {}

    /** A usable online method by key (422 on the method field otherwise). */
    public function method(string $key): PaymentMethod
    {
        $method = PaymentMethod::query()->find($key);
        $gateway = $method === null ? null : $this->gateways->for($method->kind);
        if ($method === null || $gateway === null || ! $gateway->online() || ! $this->gateways->usable($method)) {
            throw new ApiException(422, 'validation_failed', __('payments.method_unavailable'), ['method' => [__('payments.method_unavailable')]]);
        }

        return $method;
    }

    /** Whether this method key is an online one (paid on the gateway's page, no receipt). */
    public function isOnline(?string $key): bool
    {
        $method = $key === null || $key === '' ? null : PaymentMethod::query()->find($key);

        return $method !== null && ($this->gateways->for($method->kind)?->online() ?? false);
    }

    /** «ادفع أونلاين»: a checkout session for the invoice total; returns where to send the merchant. */
    public function begin(Invoice $invoice, PaymentMethod $method): string
    {
        if (! $invoice->isPayable() || $invoice->totalCents() <= 0) {
            throw new ApiException(422, 'invoice_not_open', __('payments.invoice_not_open'));
        }
        $back = rtrim(PublicSite::url((string) config('landing.app_host')), '/').'/dashboard/settings/billing/invoices/'.$invoice->id;

        try {
            $session = $this->client->createSession([
                'afterCompletion' => ['type' => 'redirect', 'redirect' => ['url' => $back.'?session={CHECKOUT_SESSION_ID}']],
                'cancelUrl' => $back,
                'lineItems' => [[
                    'priceData' => ['currency' => 'EGP', 'unitAmount' => $invoice->totalCents(), 'productData' => ['name' => $this->label($invoice)]],
                    'quantity' => 1,
                ]],
                'locale' => 'ar',
                'externalCustomerId' => 'store-'.$invoice->tenant_id,
                'metadata' => ['invoice_id' => (string) $invoice->id, 'invoice_number' => (string) $invoice->number, 'tenant_id' => (string) $invoice->tenant_id],
            ], 'invoice-'.$invoice->id.'-'.Str::lower(Str::random(16)));
        } catch (XPayError $e) {
            report($e);

            throw new ApiException(502, 'gateway_unavailable', __('payments.online.unavailable'));
        }

        $id = (string) ($session['id'] ?? '');
        $url = (string) ($session['url'] ?? '');
        if ($id === '' || ! str_starts_with($url, 'https://')) {
            Log::warning('xpay.session_without_url', ['invoice' => $invoice->id]);

            throw new ApiException(502, 'gateway_unavailable', __('payments.online.unavailable'));
        }
        Tenancy::runAs($invoice->tenant_id, fn () => OnlinePayment::query()->create([
            'invoice_id' => $invoice->id, 'gateway' => $method->kind, 'method_key' => $method->key, 'external_id' => $id,
            'amount' => Money::toDecimal($invoice->totalCents()), 'status' => OnlinePayment::OPEN,
        ]));

        return $url;
    }

    /**
     * Brings a session up to date from XPay. With an invoice, the session must be one of its own (the merchant's return
     * page); without, any session we opened (the webhook). Null when the session isn't ours.
     *
     * @throws XPayError XPay couldn't be asked (the webhook answers 500 so XPay retries)
     */
    public function settle(string $sessionId, ?Invoice $invoice = null): ?OnlinePayment
    {
        // Audited bypass: the session id is XPay's own, unique and unguessable; the row then runs in its own store.
        $row = Tenancy::withoutTenant(fn () => OnlinePayment::query()->where('external_id', $sessionId)->first());
        if ($row === null || ($invoice !== null && $row->invoice_id !== $invoice->id)) {
            return null;
        }
        if ($row->status === OnlinePayment::PAID) {
            return $row;
        }

        $session = $this->client->getSession($sessionId);
        $status = (string) ($session['status'] ?? '');
        $paid = ($session['paymentStatus'] ?? null) === 'paid' && $status === 'complete';

        if (! $paid) {
            $next = match ($status) {
                'complete' => OnlinePayment::WAITING,
                'expired' => OnlinePayment::EXPIRED,
                default => $row->status,
            };
            if ($next !== $row->status) {
                Tenancy::runAs($row->tenant_id, fn () => $row->forceFill(['status' => $next])->save());
            }

            return $row;
        }

        // The money must be what we asked for, in pounds (fees passed to the payer are on top, never instead).
        $charged = (int) ($session['amountSubtotal'] ?? $session['amountTotal'] ?? 0);
        if (($session['currency'] ?? 'EGP') !== 'EGP' || $charged < Money::toCents((string) $row->amount)) {
            Log::error('xpay.amount_mismatch', ['session' => $sessionId, 'charged' => $charged, 'expected' => (string) $row->amount]);
            Tenancy::runAs($row->tenant_id, fn () => $row->forceFill(['status' => OnlinePayment::FAILED])->save());

            return $row;
        }

        $settled = Tenancy::runAs($row->tenant_id, fn (): ?OnlinePayment => DB::transaction(function () use ($row, $session): ?OnlinePayment {
            $locked = OnlinePayment::query()->whereKey($row->id)->lockForUpdate()->firstOrFail();
            if ($locked->status === OnlinePayment::PAID) {
                return null;
            }
            $ref = (string) ($session['paymentIntentId'] ?? ($session['paymentIntent']['id'] ?? null) ?? $locked->external_id);
            $locked->forceFill(['status' => OnlinePayment::PAID, 'payment_ref' => mb_substr($ref, 0, 100), 'livemode' => (bool) ($session['livemode'] ?? false), 'paid_at' => now()])->save();
            Payment::query()->create([
                'invoice_id' => $locked->invoice_id,
                'method_key' => $locked->method_key,
                'amount' => $locked->amount,
                'sender_ref' => mb_substr($ref, 0, 120),
                'receipt_path' => null,
                'status' => PaymentStatus::Approved,
                'reviewed_at' => now(),
            ]);

            return $locked;
        }));

        if ($settled !== null) {
            $paidInvoice = Tenancy::runAs($settled->tenant_id, fn () => Invoice::query()->findOrFail($settled->invoice_id));
            $this->invoices->activate($paidInvoice);
            $this->notices->invoicePaidOnline($paidInvoice);
        }

        return $row->refresh();
    }

    /**
     * An XPay webhook (raw body + XPay-Signature). False when the signature is wrong; checkout.session events settle
     * their session from XPay itself.
     *
     * @throws XPayError
     */
    public function webhook(string $raw, string $signature): bool
    {
        if (! $this->client->signatureValid($raw, $signature)) {
            return false;
        }
        $event = json_decode($raw, true);
        $type = is_array($event) ? (string) ($event['type'] ?? '') : '';
        $id = is_array($event) ? ($event['data']['object']['id'] ?? null) : null;
        if (str_starts_with($type, 'checkout.session.') && is_string($id) && $id !== '') {
            $this->settle($id);
        }

        return true;
    }

    /** What the line on XPay's page says (the merchant sees it on his card statement and receipt). */
    private function label(Invoice $invoice): string
    {
        $snapshot = (array) $invoice->snapshot;
        $what = match ($invoice->type) {
            'ai_credit' => (string) __('payments.online.ai_credit'),
            'message_pack' => (string) __('payments.online.message_pack', ['count' => (int) ($snapshot['message_pack']['messages'] ?? 0)]),
            'theme' => (string) __('payments.online.theme', ['name' => (string) ($snapshot['theme']['name'] ?? $invoice->theme_key)]),
            default => (string) __('payments.online.plan', ['name' => (string) ($snapshot['plan']['name'] ?? $invoice->plan_key)]),
        };

        return mb_substr($what.' — '.$invoice->number, 0, 120);
    }
}
