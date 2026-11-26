<?php

declare(strict_types=1);

namespace App\Billing\Payments;

use App\Models\Invoice;
use App\Models\PaymentMethod;
use App\Support\Money;

/** Transfer to the platform's InstaPay address / wallet, then upload the receipt for review. No keys. */
final class ManualGateway implements PaymentGateway
{
    public function kind(): string
    {
        return 'manual';
    }

    public function available(): bool
    {
        return true;
    }

    public function online(): bool
    {
        return false;
    }

    public function needsAccount(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function start(Invoice $invoice, PaymentMethod $method): array
    {
        return [
            'type' => 'transfer',
            'amount' => Money::toFloat($invoice->totalCents()),
            'account_label' => $method->account_label,
            'account_value' => $method->account_value,
            'instructions' => $method->instructions,
        ];
    }

    /** "ST-00025": the store's short code on the admin's payments list. */
    public static function storeReference(int $tenantId): string
    {
        return sprintf('ST-%05d', $tenantId);
    }
}
