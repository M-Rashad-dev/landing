<?php

declare(strict_types=1);

namespace App\Ai;

use App\Billing\PlatformSettings;

/** The owner's AI settings (admin «الذكاء الاصطناعي»), read from the platform settings. */
final class AiSettings
{
    /** Every AI feature, in the order the admin page lists them (more come with each phase). */
    public const FEATURES = ['support', 'designer'];

    public function __construct(private readonly PlatformSettings $settings) {}

    public function enabled(string $feature): bool
    {
        $features = $this->settings->all()['ai_features'] ?? [];

        return is_array($features) && (bool) ($features[$feature] ?? false);
    }

    /** @return array<string, bool> */
    public function features(): array
    {
        return array_combine(self::FEATURES, array_map(fn (string $f) => $this->enabled($f), self::FEATURES));
    }

    public function dailyCapUsd(): float
    {
        return max(0.0, (float) ($this->settings->all()['ai_daily_cap_usd'] ?? 0));
    }

    public function usdRate(): ?float
    {
        $rate = $this->settings->all()['ai_usd_rate'] ?? null;

        return $rate === null || $rate === '' ? null : (float) $rate;
    }

    public function marginPercent(): float
    {
        return max(0.0, (float) ($this->settings->all()['ai_margin_percent'] ?? 0));
    }

    public function supportDailyMessages(): int
    {
        return max(0, (int) ($this->settings->all()['ai_support_daily_messages'] ?? 0));
    }

    /** @return list<int> top-up packages in EGP, smallest first */
    public function topupPackages(): array
    {
        $packages = array_values(array_unique(array_filter(array_map('intval', (array) ($this->settings->all()['ai_topup_packages'] ?? [])), fn (int $p) => $p > 0)));
        sort($packages);

        return $packages;
    }

    public function topupMin(): int
    {
        return max(1, (int) ($this->settings->all()['ai_topup_min'] ?? 1));
    }

    /** @return list<array{min: int, bonus: int}> top-up offers in EGP, smallest first */
    public function topupOffers(): array
    {
        $offers = [];
        foreach ((array) ($this->settings->all()['ai_topup_offers'] ?? []) as $offer) {
            if (is_array($offer) && (int) ($offer['min'] ?? 0) > 0 && (int) ($offer['bonus'] ?? 0) > 0) {
                $offers[] = ['min' => (int) $offer['min'], 'bonus' => (int) $offer['bonus']];
            }
        }
        usort($offers, fn ($a, $b) => $a['min'] <=> $b['min']);

        return $offers;
    }

    /** The free EGP a top-up of $amount brings (the best offer it reaches). */
    public function bonusFor(int $amount): int
    {
        $bonus = 0;
        foreach ($this->topupOffers() as $offer) {
            if ($amount >= $offer['min']) {
                $bonus = $offer['bonus'];
            }
        }

        return $bonus;
    }

    public function welcomeCredit(): int
    {
        return max(0, (int) ($this->settings->all()['ai_welcome_credit'] ?? 0));
    }

    public function lowBalance(): int
    {
        return max(0, (int) ($this->settings->all()['ai_low_balance'] ?? 0));
    }

    /** @return array<string, mixed> */
    public function toArray(): array
    {
        return [
            'features' => $this->features(),
            'daily_cap_usd' => $this->dailyCapUsd(),
            'usd_rate' => $this->usdRate(),
            'margin_percent' => $this->marginPercent(),
            'support_daily_messages' => $this->supportDailyMessages(),
            'topup_packages' => $this->topupPackages(),
            'topup_min' => $this->topupMin(),
            'topup_offers' => $this->topupOffers(),
            'welcome_credit' => $this->welcomeCredit(),
            'low_balance' => $this->lowBalance(),
        ];
    }
}
