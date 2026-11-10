<?php

declare(strict_types=1);

namespace App\Billing;

use App\Enums\BillingPeriod;
use App\Support\Money;
use Carbon\CarbonImmutable;

/** A plan price at one moment: before and after the running discount, in cents. */
final readonly class PlanPriceQuote
{
    public function __construct(
        public string $planKey,
        public BillingPeriod $period,
        public int $originalCents,
        public int $discountPercent,
        public int $finalCents,
        public ?CarbonImmutable $discountEndsAt,
    ) {}

    public function hasDiscount(): bool
    {
        return $this->finalCents < $this->originalCents;
    }

    /** @return array<string, mixed> */
    public function toArray(): array
    {
        return [
            'plan_key' => $this->planKey,
            'period' => $this->period->value,
            'original' => Money::toFloat($this->originalCents),
            'discount_percent' => $this->hasDiscount() ? $this->discountPercent : 0,
            'final' => Money::toFloat($this->finalCents),
            'discount_ends_at' => $this->hasDiscount() ? $this->discountEndsAt?->toIso8601ZuluString() : null,
        ];
    }
}
