<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Admin;

use App\Billing\PlanCatalog;
use App\Enums\InvoiceStatus;
use App\Enums\PageStatus;
use App\Enums\PaymentStatus;
use App\Enums\SubscriptionSource;
use App\Enums\TenantStatus;
use App\Http\Controllers\Concerns\RespondsWithJson;
use App\Http\Controllers\Controller;
use App\Models\Invoice;
use App\Models\LandingPage;
use App\Models\Order;
use App\Models\Payment;
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
            // Running plans (tenants carry a copy of their running plan).
            'plans' => $this->runningPlans(),
            // Audited bypass: platform-wide counts of money waiting for the admin.
            'pending_payments' => Tenancy::withoutTenant(fn () => Payment::query()->where('status', PaymentStatus::PendingReview)->count()),
            'refund_requests' => Tenancy::withoutTenant(fn () => Invoice::query()->where('status', InvoiceStatus::Paid)->whereNotNull('refund_requested_at')->count()),
            'trials' => Tenant::query()->where('plan_source', SubscriptionSource::Trial)->where('plan_ends_at', '>', now())->count(),
            'expiring_week' => Tenant::query()->whereBetween('plan_ends_at', [now(), now()->addDays(7)])->count(),
            'expired' => Tenant::query()->where(fn ($q) => $q->whereNull('plan_grace_ends_at')->orWhere('plan_grace_ends_at', '<=', now()))->count(),
        ] + $counts);
    }

    /** @return list<array{key: string, name: string, total: int}> stores per running plan, in plan order */
    private function runningPlans(): array
    {
        $totals = Tenant::query()->whereNotNull('plan_key')->where('plan_ends_at', '>', now())
            ->selectRaw('plan_key, count(*) as total')->groupBy('plan_key')->pluck('total', 'plan_key');

        $rows = [];
        foreach (app(PlanCatalog::class)->all() as $plan) {
            if (isset($totals[$plan['key']])) {
                $rows[] = ['key' => $plan['key'], 'name' => $plan['name'], 'total' => (int) $totals[$plan['key']]];
            }
        }

        return $rows;
    }
}
