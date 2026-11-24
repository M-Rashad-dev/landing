<?php

declare(strict_types=1);

namespace App\Messaging\WhatsApp;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Meta's status and category of each template, cached for a while (asked once per half hour, not
 * per message). Used to send a new version (…_v2) only once Meta approved it as Utility; until
 * then the approved previous version goes out (owner decision 2026-11-16: even if Meta put it
 * under Marketing).
 */
final class WhatsAppTemplateStatus
{
    private const CACHE_KEY = 'whatsapp:template-status';

    private const MINUTES = 30;

    public function __construct(private readonly WhatsAppGateway $gateway) {}

    /** Meta approved this template as Utility (an unknown or unreachable status counts as no). */
    public function approvedUtility(string $name): bool
    {
        $row = $this->all()[$name] ?? null;

        return $row !== null && $row['status'] === 'APPROVED' && $row['category'] === 'UTILITY';
    }

    /** Meta approved this template (any category: cart reminders are Marketing). */
    public function approved(string $name): bool
    {
        return (($this->all()[$name] ?? null)['status'] ?? null) === 'APPROVED';
    }

    /** @return array<string, array{status: string, category: string}> */
    private function all(): array
    {
        $cached = Cache::get(self::CACHE_KEY);
        if (is_array($cached)) {
            return $cached;
        }
        if (! $this->gateway->configured()) {
            return [];
        }

        try {
            $byName = [];
            foreach ($this->gateway->templates() as $row) {
                if ($row['language'] === WhatsAppTemplates::LANGUAGE) {
                    $byName[$row['name']] = ['status' => $row['status'], 'category' => $row['category']];
                }
            }
        } catch (Throwable $e) {
            // Meta unreachable: keep sending the version already approved, ask again next time.
            Log::warning('WhatsApp template status unavailable: '.$e->getMessage());

            return [];
        }

        Cache::put(self::CACHE_KEY, $byName, now()->addMinutes(self::MINUTES));

        return $byName;
    }

    /** Ask Meta again on the next message (after a push, a status check, or Meta's webhook). */
    public static function forget(): void
    {
        Cache::forget(self::CACHE_KEY);
    }
}
