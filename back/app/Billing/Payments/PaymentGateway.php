<?php

declare(strict_types=1);

namespace App\Billing\Payments;

use App\Models\Invoice;
use App\Models\PaymentMethod;

/**
 * One way of paying an invoice. Manual transfers today; an online gateway (Paymob) later adds
 * an implementation of this same contract, and invoices / activation stay unchanged.
 */
interface PaymentGateway
{
    /** The method kind this gateway serves (payment_methods.kind). */
    public function kind(): string;

    /**
     * How to pay this invoice with this method: for a transfer, the account and the
     * instructions; for an online gateway, where to send the merchant.
     *
     * @return array<string, mixed>
     */
    public function start(Invoice $invoice, PaymentMethod $method): array;
}
