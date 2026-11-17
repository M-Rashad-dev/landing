<?php

declare(strict_types=1);

namespace App\Ai;

use App\Billing\PlatformSettings;

/** The owner's AI settings (admin «الذكاء الاصطناعي»), read from the platform settings. */
final class AiSettings
{
    /** Every AI feature, in the order the admin page lists them (more come with each phase). */
    public const FEATURES = ['support'];

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

    /** @return array<string, mixed> */
    public function toArray(): array
    {
        return [
            'features' => $this->features(),
            'daily_cap_usd' => $this->dailyCapUsd(),
            'usd_rate' => $this->usdRate(),
            'margin_percent' => $this->marginPercent(),
            'support_daily_messages' => $this->supportDailyMessages(),
        ];
    }
}
