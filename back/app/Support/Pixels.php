<?php

declare(strict_types=1);

namespace App\Support;

use App\Models\Tenant;

/**
 * The merchant's tracking (owner decision, Nov 2026): one set for the store and one set that
 * every landing page listens to; the landing pages can simply use the store's. Kept in
 * tenants.settings.pixels. Only ids in the strict formats ever reach a page.
 *
 * @phpstan-type Tracking array<string, string|null>
 */
final class Pixels
{
    /** @return array{store: array<string, string|null>, landing: array<string, string|null>, landing_same: bool} */
    public function settings(Tenant $tenant): array
    {
        $saved = is_array($tenant->settings['pixels'] ?? null) ? $tenant->settings['pixels'] : [];

        return [
            'store' => $this->clean($saved['store'] ?? null, false),
            'landing' => $this->clean($saved['landing'] ?? null, true),
            'landing_same' => (bool) ($saved['landing_same'] ?? false),
        ];
    }

    /** @param array{store?: mixed, landing?: mixed, landing_same?: mixed} $values */
    public function save(Tenant $tenant, array $values): void
    {
        $settings = is_array($tenant->settings) ? $tenant->settings : [];
        $settings['pixels'] = [
            'store' => $this->clean($values['store'] ?? null, false),
            'landing' => $this->clean($values['landing'] ?? null, true),
            'landing_same' => (bool) ($values['landing_same'] ?? false),
        ];
        $tenant->forceFill(['settings' => $settings])->save();
    }

    /** What the store pages load (the store always reports Purchase with the order value). @return array<string, string|null> */
    public function forStore(int $tenantId): array
    {
        $tenant = Tenant::query()->find($tenantId);

        return ($tenant === null ? $this->clean(null, false) : $this->settings($tenant)['store']) + ['conversion_event' => 'Purchase'];
    }

    /** What every landing page loads (the store's ids when the merchant chose the same). @return array<string, string|null> */
    public function forLanding(int $tenantId): array
    {
        $tenant = Tenant::query()->find($tenantId);
        if ($tenant === null) {
            return $this->clean(null, true);
        }
        $settings = $this->settings($tenant);
        $ids = $settings['landing_same'] ? $settings['store'] : $settings['landing'];

        return array_merge($ids, ['conversion_event' => $settings['landing']['conversion_event']]);
    }

    /** @return array<string, string|null> */
    private function clean(mixed $values, bool $withConversion): array
    {
        $values = is_array($values) ? $values : [];
        $out = [];
        foreach (TrackingIds::PATTERNS as $key => $pattern) {
            $value = TrackingIds::normalize($key, $values[$key] ?? null);
            $out[$key] = is_string($value) && preg_match($pattern, $value) === 1 ? $value : null;
        }
        if ($withConversion) {
            // Purchase (with the order value) unless the merchant chose Lead: Meta needs it for ROAS.
            $out['conversion_event'] = in_array($values['conversion_event'] ?? null, TrackingIds::CONVERSION_EVENTS, true) ? $values['conversion_event'] : 'Purchase';
        }

        return $out;
    }
}
