<?php

declare(strict_types=1);

namespace App\Store\Payments\Gateways;

use App\Exceptions\ApiException;
use Illuminate\Contracts\Container\Container;

/** The gateways a store can connect (config payments.gateways), real or fake (config payments.driver). */
final class StoreGateways
{
    /** @var array<string, StoreGateway> */
    private array $made = [];

    public function __construct(private readonly Container $app) {}

    /** @return list<string> */
    public function keys(): array
    {
        return array_keys((array) config('payments.gateways'));
    }

    public function has(string $key): bool
    {
        return in_array($key, $this->keys(), true);
    }

    public function get(string $key): StoreGateway
    {
        if (! $this->has($key)) {
            throw new ApiException(404, 'gateway_not_found', (string) __('payments.gateways.not_found'));
        }
        if (isset($this->made[$key])) {
            return $this->made[$key];
        }
        /** @var StoreGateway $real */
        $real = $this->app->make((string) config('payments.gateways.'.$key));

        return $this->made[$key] = config('payments.driver') === 'fake' ? new FakeStoreGateway($key, $real->label(), $real->credentialFields()) : $real;
    }
}
