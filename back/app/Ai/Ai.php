<?php

declare(strict_types=1);

namespace App\Ai;

use App\Models\AiUsage;
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

    public function __construct(
        private readonly AiClient $client,
        private readonly AiSettings $settings,
        private readonly AdminAlerts $alerts,
    ) {}

    /** The model a task uses (config/ai.php). */
    public static function model(string $task): string
    {
        return (string) config("ai.tasks.{$task}");
    }

    /**
     * @param  list<array{role: 'system'|'user'|'assistant', content: string|list<array<string, string>>}>  $messages
     * @param  array{max_tokens?: int, temperature?: float, json?: bool, thinking?: bool}  $options
     *
     * @throws AiUnavailable
     */
    public function chat(string $feature, string $task, array $messages, array $options = [], ?int $tenantId = null): AiReply
    {
        $model = self::model($task);
        $this->guard($feature);

        try {
            $reply = $this->client->chat($model, $messages, $options);
        } catch (Throwable $e) {
            $this->failed($feature, $model, $tenantId, $e);
        }

        $this->succeeded();
        $this->record($feature, $reply->model, $tenantId, $reply->inputTokens, $reply->outputTokens, $reply->cachedTokens);

        return $reply;
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

    private function record(string $feature, string $model, ?int $tenantId, int $input, int $output, int $cached = 0): void
    {
        AiUsage::query()->create([
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
