<?php

declare(strict_types=1);

namespace App\Messaging\WhatsApp;

use App\Enums\MessageStatus;
use App\Jobs\SendWhatsAppAutoReply;
use App\Models\OutboundMessage;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\RateLimiter;

/**
 * What Meta posts to us (through Next): delivery updates for our messages, and messages people
 * send to the Mksab number. Nobody reads that number, so each sender gets one auto reply per day
 * pointing to the store they deal with.
 */
final class WhatsAppWebhook
{
    private const REPLY_EVERY = 86400;

    /** Meta's subscribe check: echo the challenge only for our verify token. */
    public function challenge(string $mode, string $token, string $challenge): ?string
    {
        $expected = (string) config('services.whatsapp.verify_token');

        return $mode === 'subscribe' && $expected !== '' && hash_equals($expected, $token) ? $challenge : null;
    }

    /** X-Hub-Signature-256 = "sha256=" + HMAC of the raw body with the app secret. */
    public function signatureValid(string $rawBody, string $header): bool
    {
        $secret = (string) config('services.whatsapp.app_secret');
        if ($secret === '' || ! str_starts_with($header, 'sha256=')) {
            return false;
        }

        return hash_equals(hash_hmac('sha256', $rawBody, $secret), substr($header, 7));
    }

    /** @param array<string, mixed> $payload */
    public function handle(array $payload): void
    {
        foreach ((array) ($payload['entry'] ?? []) as $entry) {
            foreach ((array) (is_array($entry) ? ($entry['changes'] ?? []) : []) as $change) {
                $value = is_array($change) && is_array($change['value'] ?? null) ? $change['value'] : [];
                foreach ((array) ($value['statuses'] ?? []) as $status) {
                    if (is_array($status)) {
                        $this->status($status);
                    }
                }
                foreach ((array) ($value['messages'] ?? []) as $message) {
                    if (is_array($message)) {
                        $this->incoming($message);
                    }
                }
            }
        }
    }

    /** @param array<string, mixed> $status */
    private function status(array $status): void
    {
        $next = MessageStatus::tryFrom((string) ($status['status'] ?? ''));
        $id = (string) ($status['id'] ?? '');
        if ($next === null || $next === MessageStatus::Pending || $id === '') {
            return;
        }

        $message = OutboundMessage::query()->where('provider_id', $id)->first();
        // Updates arrive out of order: never step back (a late "sent" after "read").
        if ($message === null || $message->status->rank() >= $next->rank()) {
            return;
        }

        $at = is_numeric($status['timestamp'] ?? null) ? CarbonImmutable::createFromTimestamp((int) $status['timestamp']) : now();
        $changes = ['status' => $next, "{$next->value}_at" => $at];
        if ($next === MessageStatus::Failed) {
            $error = is_array($status['errors'][0] ?? null) ? $status['errors'][0] : [];
            $details = $error['error_data']['details'] ?? null;
            $changes['error_code'] = mb_substr((string) ($error['code'] ?? ''), 0, 16) ?: null;
            $changes['error_title'] = mb_substr((string) (is_string($details) && $details !== '' ? $details : ($error['title'] ?? '')), 0, 255) ?: null;
        }
        $message->update($changes);
    }

    /** @param array<string, mixed> $message */
    private function incoming(array $message): void
    {
        $from = (string) ($message['from'] ?? '');
        if (preg_match('/^\d{8,15}$/', $from) !== 1) {
            return;
        }
        $phone = '+'.$from;

        $key = 'whatsapp-auto-reply:'.$phone;
        if (RateLimiter::tooManyAttempts($key, 1)) {
            return;
        }
        RateLimiter::hit($key, self::REPLY_EVERY);

        SendWhatsAppAutoReply::dispatch($phone);
    }
}
