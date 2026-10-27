<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Dashboard;

use App\Enums\OrderStatus;
use App\Http\Controllers\Concerns\RespondsWithJson;
use App\Http\Controllers\Controller;
use App\Http\Resources\OrderResource;
use App\Models\LandingPage;
use App\Models\Order;
use App\Support\Money;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;

/** Home dashboard numbers (Cairo calendar days). */
final class OverviewController extends Controller
{
    use RespondsWithJson;

    private const CHART_DAYS = 14;

    public function __invoke(): JsonResponse
    {
        $tz = (string) config('landing.display_timezone');
        $now = CarbonImmutable::now($tz);
        $today = $now->startOfDay();

        $since = fn (CarbonImmutable $from): int => Order::query()->where('created_at', '>=', $from->utc())->count();

        $counts = Order::query()->selectRaw('status, count(*) as aggregate')->groupBy('status')->pluck('aggregate', 'status');
        $byStatus = [];
        foreach (OrderStatus::cases() as $status) {
            $byStatus[$status->value] = (int) ($counts[$status->value] ?? 0);
        }

        // Orders per Cairo day for the chart (grouped in PHP: portable across MySQL/MariaDB/SQLite).
        $chartStart = $today->subDays(self::CHART_DAYS - 1);
        $perDay = array_fill_keys(
            array_map(fn (int $i) => $chartStart->addDays($i)->format('Y-m-d'), range(0, self::CHART_DAYS - 1)),
            0,
        );
        Order::query()->where('created_at', '>=', $chartStart->utc())->pluck('created_at')->each(function ($createdAt) use (&$perDay, $tz): void {
            $day = $createdAt->setTimezone($tz)->format('Y-m-d');
            if (isset($perDay[$day])) {
                $perDay[$day]++;
            }
        });

        $topPages = Order::query()
            ->whereNotNull('landing_page_id')
            ->selectRaw('landing_page_id, count(*) as orders_count')
            ->groupBy('landing_page_id')
            ->orderByDesc('orders_count')
            ->limit(5)
            ->get();
        $pages = LandingPage::withTrashed()->whereIn('id', $topPages->pluck('landing_page_id'))->get(['id', 'title', 'slug', 'status'])->keyBy('id');

        return $this->ok([
            'orders_today' => $since($today),
            'orders_week' => $since($today->subDays(6)),
            'orders_month' => $since($today->subDays(29)),
            'counts' => $byStatus,
            'total_orders' => array_sum($byStatus),
            'revenue_delivered' => Money::toFloat(Money::toCents((string) (Order::query()->where('status', OrderStatus::Delivered)->sum('total') ?: '0'))),
            'chart' => array_map(fn (string $day, int $count) => ['date' => $day, 'count' => $count], array_keys($perDay), array_values($perDay)),
            'top_pages' => $topPages->map(fn ($row) => [
                'id' => (int) $row->landing_page_id,
                'title' => $pages->get($row->landing_page_id)?->title,
                'slug' => $pages->get($row->landing_page_id)?->slug,
                'orders' => (int) $row->orders_count,
            ])->values()->all(),
            'latest_orders' => OrderResource::collection(Order::query()->with(['product:id,name,deleted_at'])->orderByDesc('id')->limit(5)->get())->resolve(request()),
            'pages_count' => LandingPage::query()->count(),
            'published_pages' => LandingPage::query()->where('status', 'published')->count(),
        ]);
    }
}
