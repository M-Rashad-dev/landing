<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Admin;

use App\Actions\Admin\ManageTenant;
use App\Ai\Ai;
use App\Ai\AiCost;
use App\Ai\AiSettings;
use App\Billing\PlatformSettings;
use App\Http\Controllers\Concerns\RespondsWithJson;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\AiSettingsRequest;
use App\Jobs\EmbedKnowledge;
use App\Models\AiUsage;
use App\Models\Tenant;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;

/**
 * The owner's AI page: each feature on / off, the platform's daily limit, the settings of the
 * merchants' AI balance, the connection state, and what the AI cost (today, this month, by
 * feature, by store, the last failures).
 */
final class AiController extends Controller
{
    use RespondsWithJson;

    public function __construct(private readonly AiSettings $settings, private readonly Ai $ai) {}

    public function show(): JsonResponse
    {
        $today = Ai::todayStart();
        $month = $today->setTimezone('Africa/Cairo')->startOfMonth()->utc();

        $byFeature = AiUsage::query()->where('created_at', '>=', $month)
            ->selectRaw('feature, count(*) as calls, sum(cost_usd) as usd')->groupBy('feature')->get()
            ->map(fn ($row) => ['feature' => (string) $row->feature, 'calls' => (int) $row->calls, 'usd' => round((float) $row->usd, 4)])->values();

        $stores = AiUsage::query()->where('created_at', '>=', $month)->whereNotNull('tenant_id')
            ->selectRaw('tenant_id, count(*) as calls, sum(cost_usd) as usd')->groupBy('tenant_id')->orderByDesc('usd')->limit(10)->get();
        $names = Tenant::query()->whereIn('id', $stores->pluck('tenant_id'))->pluck('name', 'id');

        $models = array_values(array_unique(array_map('strval', (array) config('ai.tasks'))));

        return $this->ok([
            'settings' => $this->settings->toArray(),
            'status' => [
                'configured' => $this->ai->configured(),
                'driver' => (string) config('ai.driver'),
                'paused_until' => $this->ai->pausedUntil()?->toIso8601String(),
                'today_usd' => round($this->ai->spentToday(), 4),
                'limit_reached' => $this->ai->spentToday() >= $this->settings->dailyCapUsd(),
            ],
            'models' => array_map(fn (string $model) => ['model' => $model, 'priced' => AiCost::priced($model)], $models),
            'usage' => [
                'today' => self::totals($today),
                'month' => self::totals($month),
                'by_feature' => $byFeature,
                'top_stores' => $stores->map(fn ($row) => ['tenant_id' => (int) $row->tenant_id, 'name' => (string) ($names[$row->tenant_id] ?? ''), 'calls' => (int) $row->calls, 'usd' => round((float) $row->usd, 4)])->values(),
                'failures' => AiUsage::query()->where('ok', false)->latest('id')->limit(10)->get()
                    ->map(fn (AiUsage $u) => ['at' => $u->created_at->toIso8601String(), 'feature' => $u->feature, 'model' => $u->model, 'error' => $u->error])->values(),
            ],
        ]);
    }

    public function update(AiSettingsRequest $request, PlatformSettings $platform, ManageTenant $audit): JsonResponse
    {
        $data = $request->validated();
        $values = [
            'ai_features' => array_map('boolval', array_intersect_key((array) $data['features'], array_flip(AiSettings::FEATURES))),
            'ai_daily_cap_usd' => (float) $data['daily_cap_usd'],
            'ai_usd_rate' => isset($data['usd_rate']) ? (float) $data['usd_rate'] : null,
            'ai_margin_percent' => (float) $data['margin_percent'],
            'ai_support_daily_messages' => (int) $data['support_daily_messages'],
        ];
        $platform->save($values);
        // Turning the assistant on prepares the knowledge base pieces still waiting for vectors.
        if ($values['ai_features']['support'] ?? false) {
            EmbedKnowledge::dispatch();
        }
        $audit->audit('ai.settings', 'platform', $values, 'settings');

        return $this->show();
    }

    /** @return array{calls: int, usd: float, failed: int} */
    private static function totals(CarbonImmutable $since): array
    {
        $row = AiUsage::query()->where('created_at', '>=', $since)
            ->selectRaw('count(*) as calls, coalesce(sum(cost_usd), 0) as usd, coalesce(sum(case when ok = 0 then 1 else 0 end), 0) as failed')->first();

        return ['calls' => (int) $row?->calls, 'usd' => round((float) $row?->usd, 4), 'failed' => (int) $row?->failed];
    }
}
