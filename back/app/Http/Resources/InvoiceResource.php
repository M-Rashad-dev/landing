<?php

declare(strict_types=1);

namespace App\Http\Resources;

use App\Models\Invoice;
use App\Models\Payment;
use App\Support\Money;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin Invoice */
final class InvoiceResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        $snapshot = $this->snapshot;

        return [
            'id' => $this->id,
            'number' => $this->number,
            'status' => $this->status->value,
            'plan' => ['key' => $this->plan_key, 'name' => $snapshot['plan']['name'] ?? $this->plan_key],
            'period' => $this->period?->value,
            'days' => $snapshot['days'] ?? null,
            'starts_now' => $this->starts_now,
            'subtotal' => Money::toFloat(Money::toCents((string) $this->subtotal)),
            'discount' => Money::toFloat(Money::toCents((string) $this->discount)),
            'credit' => Money::toFloat(Money::toCents((string) $this->credit)),
            'total' => Money::toFloat($this->totalCents()),
            'currency' => $this->currency,
            'payable' => $this->isPayable(),
            'expires_at' => $this->expires_at?->toIso8601ZuluString(),
            'paid_at' => $this->paid_at?->toIso8601ZuluString(),
            'created_at' => $this->created_at?->toIso8601ZuluString(),
            'refund_requested_at' => $this->refund_requested_at?->toIso8601ZuluString(),
            'refund_reason' => $this->refund_reason,
            'refunded_at' => $this->refunded_at?->toIso8601ZuluString(),
            'payments' => $this->whenLoaded('payments', fn () => $this->payments->map(fn (Payment $p) => [
                'id' => $p->id,
                'method' => ['key' => $p->method_key, 'name' => $p->method->name ?? $p->method_key],
                'amount' => Money::toFloat($p->amountCents()),
                'sender_ref' => $p->sender_ref,
                'status' => $p->status->value,
                'reject_reason' => $p->reject_reason,
                'created_at' => $p->created_at?->toIso8601ZuluString(),
                'reviewed_at' => $p->reviewed_at?->toIso8601ZuluString(),
            ])->all()),
        ];
    }
}
