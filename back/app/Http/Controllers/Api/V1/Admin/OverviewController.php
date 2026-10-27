<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Admin;

use App\Enums\PageStatus;
use App\Enums\TenantStatus;
use App\Http\Controllers\Concerns\RespondsWithJson;
use App\Http\Controllers\Controller;
use App\Models\LandingPage;
use App\Models\Order;
use App\Models\Tenant;
use App\Tenancy\Tenancy;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Carbon;

final class OverviewController extends Controller
{
    use RespondsWithJson;

    public function __invoke(): JsonResponse
    {
        $todayStart = Carbon::now(config('landing.display_timezone'))->startOfDay()->utc();

        // Audited bypass: platform-wide counts for the super admin.
        $counts = Tenancy::withoutTenant(fn (): array => [
            'published_pages' => LandingPage::query()->where('status', PageStatus::Published)->count(),
            'orders_today' => Order::query()->where('created_at', '>=', $todayStart)->count(),
            'orders_total' => Order::query()->count(),
        ]);

        return $this->ok([
            'tenants' => Tenant::query()->count(),
            'active_tenants' => Tenant::query()->where('status', TenantStatus::Active)->count(),
            'suspended_tenants' => Tenant::query()->where('status', TenantStatus::Suspended)->count(),
            'new_tenants_week' => Tenant::query()->where('created_at', '>=', now()->subDays(7))->count(),
        ] + $counts);
    }
}
