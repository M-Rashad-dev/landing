<?php

declare(strict_types=1);

namespace App\Services;

/**
 * Anti-bot token for the public order form: "{timestamp}.{hmac(page_id|timestamp)}" signed with
 * the app key. Valid when at least 3 seconds and at most 2 hours old (section 7.3).
 */
final class FormToken
{
    public const MIN_AGE_SECONDS = 3;

    public const MAX_AGE_SECONDS = 7200;

    public function issue(int $pageId, ?int $now = null): string
    {
        $timestamp = $now ?? time();

        return $timestamp.'.'.$this->sign($pageId, $timestamp);
    }

    public function isValid(?string $token, int $pageId, ?int $now = null): bool
    {
        if ($token === null || preg_match('/^(\d{9,12})\.([a-f0-9]{64})$/', $token, $m) !== 1) {
            return false;
        }

        $timestamp = (int) $m[1];
        $age = ($now ?? time()) - $timestamp;

        return $age >= self::MIN_AGE_SECONDS
            && $age <= self::MAX_AGE_SECONDS
            && hash_equals($this->sign($pageId, $timestamp), $m[2]);
    }

    private function sign(int $pageId, int $timestamp): string
    {
        return hash_hmac('sha256', $pageId.'|'.$timestamp, (string) config('app.key'));
    }
}
