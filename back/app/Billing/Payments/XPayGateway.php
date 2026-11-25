<?php

declare(strict_types=1);

namespace App\Billing\Payments;

use App\Billing\Payments\XPay\XPayClient;
use App\Models\Invoice;
use App\Models\PaymentMethod;
use App\Support\Money;

/**
 * XPay hosted checkout: the merchant pays the invoice by card, wallet, Fawry, valU or Apple Pay on XPay's page, and the
 * invoice is activated when XPay confirms (OnlinePayments). Shown only while the secret key is set.
 */
final class XPayGateway implements PaymentGateway
{
    public const KIND = 'xpay';

    public function __construct(private readonly XPayClient $client) {}

    public function kind(): string
    {
        return self::KIND;
    }

    public function available(): bool
    {
        return $this->client->configured();
    }

    public function online(): bool
    {
        return true;
    }

    public function needsAccount(): bool
    {
        return false;
    }

    /** @return array<string, mixed> */
    public function start(Invoice $invoice, PaymentMethod $method): array
    {
        // Nothing is asked from XPay here: the session is opened when the merchant presses «ادفع» (OnlinePayments::begin).
        return [
            'type' => 'online',
            'amount' => Money::toFloat($invoice->totalCents()),
            'instructions' => $method->instructions,
        ];
    }
}
