<?php

declare(strict_types=1);

namespace App\Actions\Admin;

use App\Billing\PlanCatalog;
use App\Billing\PlatformSettings;
use App\Enums\BillingPeriod;
use App\Enums\PlanFeature;
use App\Enums\PlanLimit;
use App\Exceptions\ApiException;
use App\Jobs\SyncPlanLocks;
use App\Models\Plan;
use App\Models\PlanFeatureValue;
use App\Models\PlanPrice;
use App\Models\Subscription;
use App\Support\CairoTime;
use App\Support\Money;
use App\Tenancy\Tenancy;
use Illuminate\Support\Facades\DB;

/** Super admin: create / edit / delete plans, every change written to admin_audit_logs. */
final class ManagePlans
{
    public function __construct(
        private readonly ManageTenant $audit,
        private readonly PlanCatalog $catalog,
        private readonly PlatformSettings $settings,
    ) {}

    /** @param array<string, mixed> $data validated PlanRequest data (with key) */
    public function create(array $data): Plan
    {
        $plan = DB::transaction(function () use ($data): Plan {
            $plan = Plan::query()->create(['key' => $data['key']] + $this->planFields($data));
            $this->savePrices($plan->key, $data['prices']);
            $this->saveValues($plan->key, $data['values']);

            return $plan;
        });

        $this->audit->audit('plan.create', $plan->key, ['after' => $this->snapshot($plan->key)], 'plan');

        return $plan;
    }

    /** @param array<string, mixed> $data validated PlanRequest data */
    public function update(Plan $plan, array $data): Plan
    {
        if (($data['is_archived'] ?? false) === true && $plan->key === $this->settings->trialPlanKey()) {
            throw new ApiException(422, 'trial_plan_invalid', __('billing.trial_plan_invalid'));
        }

        $before = $this->snapshot($plan->key);

        DB::transaction(function () use ($plan, $data): void {
            $plan->update($this->planFields($data));
            $this->savePrices($plan->key, $data['prices']);
            $this->saveValues($plan->key, $data['values']);
        });

        $after = $this->snapshot($plan->key);
        $this->audit->audit('plan.update', $plan->key, ['before' => $before, 'after' => $after], 'plan');

        // Lowered / raised limits apply to every store on the plan.
        if ($before['values'] !== $after['values']) {
            SyncPlanLocks::dispatch($plan->key);
        }

        return $plan;
    }

    /** Only a plan nobody ever had can be deleted; others are archived. */
    public function delete(Plan $plan): void
    {
        // Audited bypass: any tenant's subscription blocks the delete.
        $used = Tenancy::withoutTenant(fn () => Subscription::query()->where('plan_key', $plan->key)->exists());
        if ($used || $plan->key === $this->settings->trialPlanKey()) {
            throw new ApiException(422, 'plan_has_subscribers', __('billing.plan_has_subscribers'));
        }

        $before = $this->snapshot($plan->key);
        DB::transaction(function () use ($plan): void {
            PlanPrice::query()->where('plan_key', $plan->key)->delete();
            $plan->delete();
        });
        PlanCatalog::flush();

        $this->audit->audit('plan.delete', $plan->key, ['before' => $before], 'plan');
    }

    /** @param array<string, mixed> $values validated BillingSettingsRequest data */
    public function saveSettings(array $values): void
    {
        $before = $this->settings->all();
        $this->settings->save($values);
        $this->audit->audit('billing.settings', 'platform', ['before' => $before, 'after' => $this->settings->all()], 'settings');
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    private function planFields(array $data): array
    {
        return [
            'name' => trim(strip_tags((string) $data['name'])),
            'tagline' => isset($data['tagline']) ? trim(strip_tags((string) $data['tagline'])) : null,
            'description' => isset($data['description']) ? trim(strip_tags((string) $data['description'])) : null,
            'marketing_points' => array_values(array_filter(array_map(fn ($p) => trim(strip_tags((string) $p)), $data['marketing_points'] ?? []))),
            'is_public' => (bool) ($data['is_public'] ?? true),
            'is_highlighted' => (bool) ($data['is_highlighted'] ?? false),
            'is_archived' => (bool) ($data['is_archived'] ?? false),
            'sort_order' => (int) ($data['sort_order'] ?? 0),
        ];
    }

    /** @param array<string, array<string, mixed>|null> $prices by period; null = not sold in that period */
    private function savePrices(string $planKey, array $prices): void
    {
        foreach (BillingPeriod::cases() as $period) {
            $row = $prices[$period->value] ?? null;
            if ($row === null) {
                PlanPrice::query()->where('plan_key', $planKey)->where('period', $period->value)->get()->each->delete();

                continue;
            }

            PlanPrice::query()->updateOrCreate(['plan_key' => $planKey, 'period' => $period->value], [
                'price' => Money::toDecimal(Money::toCents((string) $row['price'])),
                'discount_percent' => (int) ($row['discount_percent'] ?? 0),
                'discount_starts_at' => CairoTime::parse($row['discount_starts_at'] ?? null),
                'discount_ends_at' => CairoTime::parse($row['discount_ends_at'] ?? null),
                'is_active' => (bool) ($row['is_active'] ?? true),
            ]);
        }
    }

    /** @param array<string, mixed> $values features as booleans, limits as int|null */
    private function saveValues(string $planKey, array $values): void
    {
        foreach (PlanFeature::cases() as $feature) {
            PlanFeatureValue::query()->updateOrCreate(['plan_key' => $planKey, 'entitlement' => $feature->value], ['value' => ($values[$feature->value] ?? false) ? 1 : 0]);
        }
        foreach (PlanLimit::cases() as $limit) {
            $value = array_key_exists($limit->value, $values) ? $values[$limit->value] : 0;
            PlanFeatureValue::query()->updateOrCreate(['plan_key' => $planKey, 'entitlement' => $limit->value], ['value' => $value === null ? null : (int) $value]);
        }
    }

    /** @return array<string, mixed> */
    private function snapshot(string $planKey): array
    {
        PlanCatalog::flush();
        $plan = $this->catalog->plan($planKey) ?? [];

        return ['name' => $plan['name'] ?? null, 'prices' => $plan['prices'] ?? [], 'values' => $plan['values'] ?? [], 'is_archived' => $plan['is_archived'] ?? null];
    }
}
