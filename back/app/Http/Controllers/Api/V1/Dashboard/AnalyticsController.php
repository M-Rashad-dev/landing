<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Dashboard;

use App\Billing\Entitlements;
use App\Enums\PlanFeature;
use App\Http\Controllers\Concerns\RespondsWithJson;
use App\Http\Controllers\Controller;
use App\Rules\TenantExists;
use App\Services\PageAnalytics;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class AnalyticsController extends Controller
{
    use RespondsWithJson;

    /** Range in Cairo days, at most one year; defaults to the last 30 days. */
    public function __invoke(Request $request, PageAnalytics $analytics): JsonResponse
    {
        app(Entitlements::class)->ensure(PlanFeature::AdvancedAnalytics);

        $data = $request->validate([
            'from' => ['nullable', 'date_format:Y-m-d'],
            'to' => ['nullable', 'date_format:Y-m-d', 'after_or_equal:from'],
            'page_id' => ['nullable', 'integer', TenantExists::table('landing_pages')],
        ]);

        $today = CarbonImmutable::now(PageAnalytics::TZ)->startOfDay();
        $to = isset($data['to']) ? CarbonImmutable::parse($data['to'], PageAnalytics::TZ) : $today;
        $from = isset($data['from']) ? CarbonImmutable::parse($data['from'], PageAnalytics::TZ) : $to->subDays(29);
        if ($from->diffInDays($to) > 366) {
            $from = $to->subDays(366);
        }

        return $this->ok($analytics->report($from, $to, isset($data['page_id']) ? (int) $data['page_id'] : null));
    }
}
