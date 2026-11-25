<?php

declare(strict_types=1);

namespace App\Store\Payments\Gateways;

use App\Models\StoreGatewayAccount;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/** What every HTTP gateway shares: a client with a timeout, and refusals turned into GatewayError for the merchant. */
abstract class HttpGateway implements StoreGateway
{
    public function disconnect(StoreGatewayAccount $account): void {}

    protected function http(string $baseUrl): PendingRequest
    {
        return Http::baseUrl(rtrim($baseUrl, '/'))->acceptJson()->asJson()->timeout(max(5, (int) config('payments.timeout', 20)));
    }

    /**
     * Runs a call and returns its JSON; 401 / 403 → wrong credentials.
     *
     * @param  callable(): Response  $call
     * @return array<string, mixed>
     *
     * @throws GatewayError
     */
    protected function send(callable $call): array
    {
        try {
            $response = $call();
        } catch (ConnectionException $e) {
            throw new GatewayError((string) __('payments.gateways.unreachable', ['gateway' => $this->label()]), detail: $e->getMessage());
        }
        if ($response->status() === 401 || $response->status() === 403) {
            throw new GatewayError((string) __('payments.gateways.auth', ['gateway' => $this->label()]), true, mb_substr($response->body(), 0, 300));
        }
        if (! $response->successful() || ! is_array($response->json())) {
            Log::warning('store_gateway.refused', ['gateway' => $this->key(), 'status' => $response->status(), 'body' => mb_substr($response->body(), 0, 500)]);

            throw new GatewayError((string) __('payments.gateways.refused', ['gateway' => $this->label()]), detail: 'HTTP '.$response->status().': '.mb_substr($response->body(), 0, 300));
        }

        return $response->json();
    }

    /** "Sara Mohamed Ali" → ["Sara", "Mohamed Ali"] (gateways want both, never empty). @return array{0: string, 1: string} */
    protected static function names(string $full): array
    {
        $parts = preg_split('/\s+/u', trim($full)) ?: [];
        $first = (string) ($parts[0] ?? '');

        return [mb_substr($first !== '' ? $first : 'Customer', 0, 50), mb_substr(trim(implode(' ', array_slice($parts, 1))) ?: ($first !== '' ? $first : 'Customer'), 0, 50)];
    }
}
