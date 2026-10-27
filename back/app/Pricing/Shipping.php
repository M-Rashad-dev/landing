<?php

declare(strict_types=1);

namespace App\Pricing;

use App\Models\ShippingRate;
use App\Models\ShippingSetting;
use App\Support\Money;

/**
 * Delivery fee for the current tenant (used by PriceCalculator, the only price authority).
 * Disabled → no fee. Enabled → the governorate's fee (or the default), free above the threshold.
 */
final class Shipping
{
    /** @return array{enabled: bool, default: int, free_over: int|null, rates: array<string, array{fee: int|null, available: bool}>} */
    public function config(): array
    {
        $settings = ShippingSetting::query()->first();
        $rates = [];
        foreach (ShippingRate::query()->get() as $rate) {
            $rates[$rate->governorate] = ['fee' => $rate->fee === null ? null : Money::toCents((string) $rate->fee), 'available' => $rate->is_available];
        }

        return [
            'enabled' => (bool) $settings?->enabled,
            'default' => $settings === null ? 0 : Money::toCents((string) $settings->default_fee),
            'free_over' => $settings?->free_over === null ? null : Money::toCents((string) $settings->free_over),
            'rates' => $rates,
        ];
    }

    /**
     * @param  int  $itemsTotal  after offer and code, in cents
     * @return array{fee: int|null, free: bool, available: bool} fee null = not known yet (no governorate) or shipping off
     */
    public function quote(?string $governorate, int $itemsTotal): array
    {
        $config = $this->config();
        if (! $config['enabled']) {
            return ['fee' => null, 'free' => false, 'available' => true];
        }
        if ($governorate === null || trim($governorate) === '') {
            return ['fee' => null, 'free' => false, 'available' => true];
        }

        $rate = $config['rates'][$governorate] ?? ['fee' => null, 'available' => true];
        if (! $rate['available']) {
            return ['fee' => null, 'free' => false, 'available' => false];
        }

        $free = $config['free_over'] !== null && $itemsTotal >= $config['free_over'];

        return ['fee' => $free ? 0 : ($rate['fee'] ?? $config['default']), 'free' => $free, 'available' => true];
    }

    /** What the order form needs to show fees before asking the server. @return array<string, mixed> */
    public function publicConfig(): array
    {
        $config = $this->config();
        if (! $config['enabled']) {
            return ['enabled' => false];
        }

        $fees = [];
        $unavailable = [];
        foreach ((array) config('landing.governorates') as $governorate) {
            $rate = $config['rates'][$governorate] ?? ['fee' => null, 'available' => true];
            if (! $rate['available']) {
                $unavailable[] = $governorate;

                continue;
            }
            $fees[$governorate] = Money::toFloat($rate['fee'] ?? $config['default']);
        }

        return [
            'enabled' => true,
            'fees' => $fees,
            'unavailable' => $unavailable,
            'free_over' => $config['free_over'] === null ? null : Money::toFloat($config['free_over']),
        ];
    }
}
