<?php

declare(strict_types=1);

namespace App\Shipping\Carriers;

use App\Exceptions\ApiException;
use Illuminate\Contracts\Container\Container;

/** The carriers a store can connect (config shipping.carriers), real or fake (config shipping.driver). */
final class Carriers
{
    /** @var array<string, Carrier> */
    private array $made = [];

    public function __construct(private readonly Container $app) {}

    /** @return list<string> */
    public function keys(): array
    {
        return array_keys((array) config('shipping.carriers'));
    }

    public function has(string $key): bool
    {
        return in_array($key, $this->keys(), true);
    }

    public function get(string $key): Carrier
    {
        if (! $this->has($key)) {
            throw new ApiException(404, 'carrier_not_found', (string) __('shipping.carriers.not_found'));
        }

        return $this->made[$key] ??= config('shipping.driver') === 'fake'
            ? new FakeCarrier($key, (string) __('shipping.carriers.names.'.$key))
            : $this->app->make((string) config('shipping.carriers.'.$key));
    }
}
