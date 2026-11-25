<?php

declare(strict_types=1);

namespace App\Billing\Payments;

use App\Models\Invoice;
use App\Models\PaymentMethod;

/** Every gateway by method kind; the ways an invoice can be paid right now. */
final class PaymentGateways
{
    /** @var array<string, PaymentGateway> */
    private array $byKind = [];

    public function __construct(ManualGateway $manual, XPayGateway $xpay)
    {
        foreach ([$manual, $xpay] as $gateway) {
            $this->byKind[$gateway->kind()] = $gateway;
        }
    }

    public function for(string $kind): ?PaymentGateway
    {
        return $this->byKind[$kind] ?? null;
    }

    /** A method the merchant can pay with now: active, its gateway available, its account filled when it needs one. */
    public function usable(PaymentMethod $method): bool
    {
        $gateway = $this->for($method->kind);

        return $gateway !== null && $method->is_active && $gateway->available()
            && (! $gateway->needsAccount() || ($method->account_value !== null && $method->account_value !== ''));
    }

    /** @return list<array<string, mixed>> */
    public function options(Invoice $invoice): array
    {
        if (! $invoice->isPayable()) {
            return [];
        }

        $options = [];
        foreach (PaymentMethod::query()->where('is_active', true)->orderBy('sort_order')->orderBy('key')->get() as $method) {
            if ($this->usable($method)) {
                $gateway = $this->for($method->kind);
                $options[] = ['key' => $method->key, 'name' => $method->name, 'kind' => $method->kind] + $gateway->start($invoice, $method);
            }
        }

        return $options;
    }
}
