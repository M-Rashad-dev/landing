<?php

declare(strict_types=1);

namespace App\Services\Webhooks;

use App\Enums\WebhookKind;
use App\Models\Tenant;
use App\Models\Webhook;
use App\Models\WebhookDelivery;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Throwable;

/**
 * One signed POST to a webhook, logged. Signature: hex HMAC-SHA256 of "{timestamp}.{body}" with
 * the webhook secret, sent as X-Webhook-Signature: sha256=…
 */
final class WebhookSender
{
    public function __construct(private readonly OutboundUrl $urls) {}

    /** @param array<string, mixed> $data */
    public function send(Webhook $webhook, string $event, array $data, int $attempt = 1): WebhookDelivery
    {
        $started = microtime(true);
        $id = (string) Str::uuid();
        $timestamp = (string) time();
        $body = (string) json_encode([
            'id' => $id,
            'event' => $event,
            'sent_at' => now()->toIso8601ZuluString(),
            'store' => Tenant::query()->whereKey($webhook->tenant_id)->value('name'),
            'data' => $data,
        ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

        [$code, $error] = $this->post($webhook, $body, $id, $event, $timestamp);
        $ok = $error === null;

        $delivery = $webhook->deliveries()->create([
            'event' => $event,
            'status' => $ok ? 'success' : 'failed',
            'response_code' => $code,
            'error' => $error === null ? null : mb_substr($error, 0, 255),
            'attempt' => $attempt,
            'duration_ms' => (int) round((microtime(true) - $started) * 1000),
        ]);

        $webhook->forceFill([
            'last_delivery_at' => now(),
            'last_status' => $ok ? 'success' : 'failed',
            'failures_count' => $ok ? 0 : $webhook->failures_count + 1,
        ])->save();

        // Keep the log short.
        $keepFrom = $webhook->deliveries()->orderByDesc('id')->skip(WebhookDelivery::KEEP - 1)->value('id');
        if ($keepFrom !== null) {
            $webhook->deliveries()->where('id', '<', $keepFrom)->delete();
        }

        return $delivery;
    }

    /** @return array{0: int|null, 1: string|null} response code and error (null = delivered) */
    private function post(Webhook $webhook, string $body, string $id, string $event, string $timestamp): array
    {
        $ip = $this->urls->resolve($webhook->url);
        if ($ip === null) {
            return [null, __('integrations.blocked_address')];
        }
        $host = (string) parse_url($webhook->url, PHP_URL_HOST);
        $sheets = $webhook->kind === WebhookKind::GoogleSheets;

        try {
            $response = Http::timeout(10)
                ->connectTimeout(5)
                ->withHeaders([
                    'User-Agent' => 'LandingPlatform-Webhooks/1.0',
                    'X-Webhook-Id' => $id,
                    'X-Webhook-Event' => $event,
                    'X-Webhook-Timestamp' => $timestamp,
                    'X-Webhook-Signature' => 'sha256='.hash_hmac('sha256', $timestamp.'.'.$body, $webhook->secret),
                ])
                ->withOptions([
                    // Apps Script answers through a redirect to googleusercontent.com; plain webhooks never follow redirects.
                    'allow_redirects' => $sheets ? ['max' => 3, 'protocols' => ['https']] : false,
                    'curl' => [CURLOPT_RESOLVE => ["{$host}:443:{$ip}"]],
                ])
                ->withBody($body, 'application/json')
                ->post($webhook->url);
        } catch (Throwable $e) {
            return [null, __('integrations.unreachable')];
        }

        return $response->successful() ? [$response->status(), null] : [$response->status(), __('integrations.http_error', ['code' => $response->status()])];
    }
}
