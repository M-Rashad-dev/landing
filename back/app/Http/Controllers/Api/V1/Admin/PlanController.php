<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Admin;

use App\Actions\Admin\ManagePlans;
use App\Billing\PlanPresenter;
use App\Billing\PlatformSettings;
use App\Http\Controllers\Concerns\RespondsWithJson;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\BillingSettingsRequest;
use App\Http\Requests\Admin\PlanRequest;
use App\Models\Plan;
use App\Models\Tenant;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Response;

/** «الباقات» in the admin: plans, prices, features / limits and the free trial. */
final class PlanController extends Controller
{
    use RespondsWithJson;

    public function __construct(private readonly PlanPresenter $presenter, private readonly ManagePlans $plans) {}

    public function index(PlatformSettings $settings): JsonResponse
    {
        return $this->ok($this->presenter->admin($this->subscribers()), [
            'entitlements' => PlanPresenter::entitlementCatalog(),
            'settings' => $settings->all(),
        ]);
    }

    public function store(PlanRequest $request): JsonResponse
    {
        $plan = $this->plans->create($request->validated());

        return $this->created($this->row($plan->key));
    }

    public function update(PlanRequest $request, string $key): JsonResponse
    {
        $this->plans->update(Plan::query()->findOrFail($key), $request->validated());

        return $this->ok($this->row($key));
    }

    public function destroy(string $key): Response
    {
        $this->plans->delete(Plan::query()->findOrFail($key));

        return $this->noContent();
    }

    public function updateSettings(BillingSettingsRequest $request, PlatformSettings $settings): JsonResponse
    {
        $this->plans->saveSettings($request->validated());

        return $this->ok($settings->all());
    }

    /** @return array<string, mixed> */
    private function row(string $key): array
    {
        return collect($this->presenter->admin($this->subscribers()))->firstWhere('key', $key) ?? abort(404);
    }

    /** Stores whose running plan is each key (tenants table is not tenant-scoped). @return array<string, int> */
    private function subscribers(): array
    {
        return Tenant::query()
            ->whereNotNull('plan_key')
            ->where('plan_ends_at', '>', now())
            ->selectRaw('plan_key, count(*) as total')
            ->groupBy('plan_key')
            ->pluck('total', 'plan_key')
            ->map(fn ($n) => (int) $n)
            ->all();
    }
}
