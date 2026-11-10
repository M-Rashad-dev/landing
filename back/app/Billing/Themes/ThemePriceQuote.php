<?php

declare(strict_types=1);

namespace App\Billing\Themes;

use App\Support\Money;
use Carbon\CarbonImmutable;

/** A theme price at one moment: before and after the running discount, in cents (paid once). */
final readonly class ThemePriceQuote
{
    public function __construct(
        public string $themeKey,
        public int $originalCents,
        public int $discountPercent,
        public int $finalCents,
        public ?CarbonImmutable $discountEndsAt,
    ) {}

    public function isFree(): bool
    {
        return $this->originalCents === 0;
    }

    /** @return array<string, mixed> */
    public function toArray(): array
    {
        $discounted = $this->finalCents < $this->originalCents;

        return [
            'original' => Money::toFloat($this->originalCents),
            'discount_percent' => $discounted ? $this->discountPercent : 0,
            'final' => Money::toFloat($this->finalCents),
            'discount_ends_at' => $discounted ? $this->discountEndsAt?->toIso8601ZuluString() : null,
        ];
    }
}
