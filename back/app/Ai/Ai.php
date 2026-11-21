<?php

declare(strict_types=1);

namespace App\Ai;

use App\Exceptions\ApiException;
use App\Models\AiUsage;
use App\Models\Tenant;
use App\Services\AdminAlerts;
use App\Support\CairoTime;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Cache;
use Throwable;

/**
 * The one door to the AI for every feature: it asks only when the feature is on, the keys are
 * there, today's platform limit isn't reached and the AI isn't paused; it records every call and
 * its cost (AiUsage); after a few failures in a row it pauses for a while and tells the owner.
 * Features catch AiUnavailable and fall back (support → a person).
 */
final class Ai
{
    private const FAILURES_KEY = 'ai:failures';

    private const PAUSED_KEY = 'ai:paused_until';

    /** The usage row of the last successful call (a paid feature charges it). */
    private ?AiUsage $last = null;

    public function lastUsage(): ?AiUsage
    {
        return $this->last;
    }

    public function __construct(
        private readonly AiClient $client,
        private readonly AiSettings $settings,
        private readonly AdminAlerts $alerts,
        private readonly AiWallets $wallets,
    ) {}

    /** The model a task uses (config/ai.php). */
    public static function model(string $task): string
    {
        return (string) config("ai.tasks.{$task}");
    }

    /**
     * @param  list<array{role: 'system'|'user'|'assistant', content: string|list<array<string, string>>}>  $messages
     * @param  array{max_tokens?: int, temperature?: float, json?: bool, thinking?: bool, effort?: string}  $options
     *
     * @throws AiUnavailable
     */
    public function chat(string $feature, string $task, array $messages, array $options = [], ?int $tenantId = null): AiReply
    {
        $model = self::model($task);
        $this->guard($feature);

        if (! isset($options['effort'])) {
            $effort = config("ai.effort.{$task}");
            if (is_string($effort) && trim($effort) !== '') {
                $options['effort'] = trim($effort);
            }
        }

        try {
            $reply = $this->client->chat($model, $messages, $options);
        } catch (Throwable $e) {
            $this->failed($feature, $model, $tenantId, $e);
        }

        $this->succeeded();
        $this->last = $this->record($feature, $reply->model, $tenantId, $reply->inputTokens, $reply->outputTokens, $reply->cachedTokens);

        return $reply;
    }

    /**
     * A call the merchant pays for from the AI balance: refused up front when the balance can't
     * cover the most it could cost; charged its real cost after (nothing when it fails).
     *
     * @param  list<array{role: 'system'|'user'|'assistant', content: string|list<array<string, string>>}>  $messages
     * @param  array{max_tokens?: int, temperature?: float, json?: bool, thinking?: bool, effort?: string}  $options
     *
     * @throws AiUnavailable|ApiException
     */
    public function chatPaid(Tenant $tenant, string $feature, string $task, array $messages, array $options, string $description): AiReply
    {
        $this->guard($feature);
        // Tool definitions are sent as input too.
        $forEstimate = empty($options['tools']) ? $messages : [...$messages, ['role' => 'system', 'content' => (string) json_encode($options['tools'], JSON_UNESCAPED_UNICODE)]];
        $this->wallets->ensureCanSpend($tenant, self::estimate(self::model($task), $forEstimate, (int) ($options['max_tokens'] ?? 2000)));
        $reply = $this->chat($feature, $task, $messages, $options, $tenant->id);
        if ($this->last !== null) {
            $this->wallets->charge($tenant, $this->last, $feature, $description);
        }

        return $reply;
    }

    /**
     * An image generation or editing call paid from the merchant's AI balance: refused up front
     * when the balance can't cover the estimated image price, and charged the real provider cost
     * (or the configured per-image price) on success. Failures cost nothing.
     *
     * @param  callable(AiClient, string): AiImage  $call
     *
     * @throws AiUnavailable|ApiException
     */
    public function imagePaid(Tenant $tenant, string $feature, string $task, callable $call, string $description): AiImage
    {
        $model = self::model($task);
        $this->guard($feature);

        $estimatedPrice = (float) (AiCost::imagePrice($model) ?? 0.0);
        $this->wallets->ensureCanSpend($tenant, $estimatedPrice);

        try {
            /** @var AiImage $image */
            $image = $call($this->client, $model);
        } catch (Throwable $e) {
            $this->failed($feature, $model, $tenant->id, $e);
        }

        $this->succeeded();
        $costUsd = $image->costUsd !== null
            ? round(max(0.0, $image->costUsd), 6)
            : round((float) (AiCost::imagePrice($image->model) ?? $estimatedPrice), 6);

        $this->last = AiUsage::query()->create([
            'tenant_id' => $tenant->id,
            'feature' => $feature,
            'model' => $image->model,
            'input_tokens' => 0,
            'cached_tokens' => 0,
            'output_tokens' => 0,
            'images' => 1,
            'cost_usd' => $costUsd,
        ]);

        $this->wallets->charge($tenant, $this->last, $feature, $description);

        return $image;
    }

    /**
     * The most a call could cost (USD): its text and pictures as input tokens (about 3 characters
     * a token, ~1500 tokens a picture) and the whole output allowance.
     *
     * @param  list<array<string, mixed>>  $messages
     */
    public static function estimate(string $model, array $messages, int $maxOutput): float
    {
        $chars = 0;
        $images = 0;
        foreach ($messages as $message) {
            if (isset($message['tool_calls'])) {
                $chars += mb_strlen((string) json_encode($message['tool_calls'], JSON_UNESCAPED_UNICODE));
            }
            $content = $message['content'] ?? '';
            foreach (is_array($content) ? $content : [['type' => 'text', 'text' => $content]] as $part) {
                ($part['type'] ?? 'text') === 'image' ? $images++ : $chars += mb_strlen((string) ($part['text'] ?? ''));
            }
        }

        return AiCost::usd($model, (int) ceil($chars / 3) + $images * 1500, $maxOutput);
    }

    /**
     * @param  list<string>  $texts
     *
     * @throws AiUnavailable
     */
    public function embed(string $feature, string $task, array $texts, ?int $tenantId = null): AiEmbeddings
    {
        $model = self::model($task);
        $this->guard($feature);

        try {
            $result = $this->client->embed($model, $texts);
        } catch (Throwable $e) {
            $this->failed($feature, $model, $tenantId, $e);
        }

        $this->succeeded();
        $this->record($feature, $result->model, $tenantId, $result->inputTokens, 0);

        return $result;
    }

    /** Whether a feature would be asked now (no exception): for screens and fallbacks. */
    public function available(string $feature): bool
    {
        return $this->blocker($feature) === null;
    }

    /** Why a feature isn't asked now, or null. */
    public function blocker(string $feature): ?string
    {
        return match (true) {
            ! $this->settings->enabled($feature) => AiUnavailable::OFF,
            ! $this->client->configured() => AiUnavailable::NOT_CONFIGURED,
            $this->pausedUntil() !== null => AiUnavailable::PAUSED,
            $this->spentToday() >= $this->settings->dailyCapUsd() => AiUnavailable::DAILY_LIMIT,
            default => null,
        };
    }

    public function configured(): bool
    {
        return $this->client->configured();
    }

    /** Until when the AI rests after failures in a row (null = not paused). */
    public function pausedUntil(): ?CarbonImmutable
    {
        $until = Cache::get(self::PAUSED_KEY);

        return is_string($until) && CarbonImmutable::parse($until)->isFuture() ? CarbonImmutable::parse($until) : null;
    }

    /** USD spent on the provider today (Cairo day). */
    public function spentToday(): float
    {
        return (float) AiUsage::query()->where('created_at', '>=', self::todayStart())->sum('cost_usd');
    }

    public static function todayStart(): CarbonImmutable
    {
        return CarbonImmutable::now(CairoTime::ZONE)->startOfDay()->utc();
    }

    /** @throws AiUnavailable */
    private function guard(string $feature): void
    {
        $reason = $this->blocker($feature);
        if ($reason !== null) {
            throw new AiUnavailable($reason);
        }
    }

    private function record(string $feature, string $model, ?int $tenantId, int $input, int $output, int $cached = 0): AiUsage
    {
        return AiUsage::query()->create([
            'tenant_id' => $tenantId,
            'feature' => $feature,
            'model' => $model,
            'input_tokens' => $input,
            'cached_tokens' => $cached,
            'output_tokens' => $output,
            'cost_usd' => AiCost::usd($model, $input, $output, $cached),
        ]);
    }

    /** @throws AiUnavailable always */
    private function failed(string $feature, string $model, ?int $tenantId, Throwable $e): never
    {
        report($e);
        AiUsage::query()->create(['tenant_id' => $tenantId, 'feature' => $feature, 'model' => $model, 'ok' => false, 'error' => mb_substr($e->getMessage(), 0, 300)]);

        // The platform's provider account itself (no credit, bad key): no pause (other calls may still work, e.g. text
        // when only images need more credit), the admins are told at once, the merchant learns it is not his account.
        if ($e instanceof AiError && in_array($e->status, [401, 402, 403], true)) {
            $this->alerts->aiProvider(mb_substr($e->getMessage(), 0, 200));

            throw new AiUnavailable(AiUnavailable::PROVIDER);
        }

        $failures = (int) Cache::increment(self::FAILURES_KEY);
        if ($failures >= (int) config('ai.breaker.failures', 3)) {
            $minutes = (int) config('ai.breaker.pause_minutes', 5);
            Cache::put(self::PAUSED_KEY, CarbonImmutable::now()->addMinutes($minutes)->toIso8601String(), now()->addMinutes($minutes));
            Cache::forget(self::FAILURES_KEY);
            $this->alerts->aiPaused(mb_substr($e->getMessage(), 0, 200), $minutes);
        }

        throw new AiUnavailable(AiUnavailable::FAILED);
    }

    private function succeeded(): void
    {
        Cache::forget(self::FAILURES_KEY);
    }
}
