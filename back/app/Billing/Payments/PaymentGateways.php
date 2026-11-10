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

    public function __construct(ManualGateway $manual)
    {
        foreach ([$manual] as $gateway) {
            $this->byKind[$gateway->kind()] = $gateway;
        }
    }

    /** @return list<array<string, mixed>> */
    public function options(Invoice $invoice): array
    {
        if (! $invoice->isPayable()) {
            return [];
        }

        $options = [];
        foreach (PaymentMethod::query()->usable()->get() as $method) {
            $gateway = $this->byKind[$method->kind] ?? null;
            if ($gateway !== null) {
                $options[] = ['key' => $method->key, 'name' => $method->name, 'kind' => $method->kind] + $gateway->start($invoice, $method);
            }
        }

        return $options;
    }
}
