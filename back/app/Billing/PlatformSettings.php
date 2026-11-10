<?php

declare(strict_types=1);

namespace App\Billing;

use App\Models\PlatformSetting;
use Illuminate\Support\Facades\Cache;

/**
 * Platform settings the super admin controls (free trial, grace hours), with safe defaults
 * when a key was never saved. Cached as one array, flushed on every save.
 */
final class PlatformSettings
{
    private const CACHE_KEY = 'billing:platform-settings:v1';

    public const DEFAULTS = [
        'trial_enabled' => true,
        'trial_days' => 14,
        'trial_plan_key' => 'basic',
        'grace_hours' => 24,
    ];

    /** @var array<string, mixed>|null */
    private ?array $memo = null;

    /** @return array<string, mixed> */
    public function all(): array
    {
        return $this->memo ??= array_merge(self::DEFAULTS, Cache::rememberForever(
            self::CACHE_KEY,
            fn (): array => PlatformSetting::query()->pluck('value', 'key')->all(),
        ));
    }

    public function trialEnabled(): bool
    {
        return (bool) $this->all()['trial_enabled'];
    }

    public function trialDays(): int
    {
        return max(1, (int) $this->all()['trial_days']);
    }

    public function trialPlanKey(): string
    {
        return (string) $this->all()['trial_plan_key'];
    }

    public function graceHours(): int
    {
        return max(0, (int) $this->all()['grace_hours']);
    }

    /** @param array<string, mixed> $values known keys only */
    public function save(array $values): void
    {
        foreach (array_intersect_key($values, self::DEFAULTS) as $key => $value) {
            PlatformSetting::query()->updateOrCreate(['key' => $key], ['value' => $value]);
        }
    }

    public static function flush(): void
    {
        Cache::forget(self::CACHE_KEY);

        if (app()->resolved(self::class)) {
            app(self::class)->memo = null;
        }
    }
}
