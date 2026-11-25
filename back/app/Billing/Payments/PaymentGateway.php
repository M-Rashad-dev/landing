<?php

declare(strict_types=1);

namespace App\Billing\Payments;

use App\Models\Invoice;
use App\Models\PaymentMethod;

/**
 * One way of paying an invoice: a manual transfer (receipt reviewed by the admin) or an online gateway (XPay). Each is
 * an implementation of this contract, registered in PaymentGateways; invoices and activation never change for a new one.
 */
interface PaymentGateway
{
    /** The method kind this gateway serves (payment_methods.kind). */
    public function kind(): string;

    /** It can take payments now (an online gateway needs its keys). */
    public function available(): bool;

    /** Paid on the gateway's own page (no receipt to upload); the invoice is activated when the gateway confirms. */
    public function online(): bool;

    /** The method needs the platform's account to show (an InstaPay address, a wallet number). */
    public function needsAccount(): bool;

    /**
     * How to pay this invoice with this method: for a transfer, the account and the
     * instructions; for an online gateway, where to send the merchant.
     *
     * @return array<string, mixed>
     */
    public function start(Invoice $invoice, PaymentMethod $method): array;
}
