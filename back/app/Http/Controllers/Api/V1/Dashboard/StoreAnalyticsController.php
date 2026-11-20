<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Dashboard;

use App\Analytics\StoreTraffic;
use App\Billing\Entitlements;
use App\Enums\PlanFeature;
use App\Http\Controllers\Concerns\RespondsWithJson;
use App\Http\Controllers\Controller;
use App\Models\Order;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * «التحليلات» of the store: visits and the purchase steps (first-party counters, no personal
 * data), orders and sales per Cairo day, compared with the same number of days just before;
 * where visitors and orders come from, devices, new and returning customers, abandoned carts,
 * best products, governorates and the hours customers order at. Store orders only; cancelled
 * and fake orders do not count.
 */
final class StoreAnalyticsController extends Controller
{
    use RespondsWithJson;

    private const TZ = 'Africa/Cairo';

    public function __construct(private readonly StoreTraffic $traffic) {}

    public function __invoke(Request $request, Entitlements $entitlements): JsonResponse
    {
        $entitlements->ensure(PlanFeature::Store);
        $data = $request->validate([
            'from' => ['nullable', 'date_format:Y-m-d'],
            'to' => ['nullable', 'date_format:Y-m-d', 'after_or_equal:from'],
        ]);
        $to = isset($data['to']) ? CarbonImmutable::parse($data['to'], self::TZ) : CarbonImmutable::now(self::TZ)->startOfDay();
        $from = isset($data['from']) ? CarbonImmutable::parse($data['from'], self::TZ) : $to->subDays(29);
        if ($from->diffInDays($to) > 366) {
            $from = $to->subDays(366);
        }

        return $this->ok($this->traffic->report($from, $to));
    }
}
