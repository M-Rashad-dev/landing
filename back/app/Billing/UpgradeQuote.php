<?php

declare(strict_types=1);

namespace App\Billing;

use App\Support\Money;

/** What a merchant pays to move to another plan / period right now. */
final readonly class UpgradeQuote
{
    public function __construct(
        public PlanPriceQuote $price,
        /** Amount of the current paid period taken off (only inside the difference window). */
        public int $creditCents,
        public int $payCents,
        /** Starts now (upgrade) or after the current period (renewal / downgrade). */
        public bool $startsNow,
    ) {}

    /** @return array<string, mixed> */
    public function toArray(): array
    {
        return $this->price->toArray() + [
            'credit' => Money::toFloat($this->creditCents),
            'pay' => Money::toFloat($this->payCents),
            'starts_now' => $this->startsNow,
        ];
    }
}
