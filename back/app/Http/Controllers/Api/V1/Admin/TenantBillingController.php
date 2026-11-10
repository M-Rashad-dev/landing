<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Admin;

use App\Actions\Admin\ManageTenant;
use App\Billing\Entitlements;
use App\Billing\SubscriptionManager;
use App\Billing\UsageCounter;
use App\Enums\PlanFeature;
use App\Enums\PlanLimit;
use App\Http\Controllers\Concerns\RespondsWithJson;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\EntitlementOverrideRequest;
use App\Jobs\SyncPlanLocks;
use App\Models\EntitlementOverride;
use App\Models\Subscription;
use App\Models\Tenant;
use App\Support\CairoTime;
use App\Support\Money;
use App\Tenancy\Tenancy;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Validation\Rule;

/**
 * One store's plan in the admin: grant / extend, per-store overrides, history and usage.
 * Audited: tenant data is read inside Tenancy::runAs($tenant) (the admin has no tenant).
 */
final class TenantBillingController extends Controller
{
    use RespondsWithJson;

    public function __construct(
        private readonly SubscriptionManager $subscriptions,
        private readonly ManageTenant $audit,
    ) {}

    public function show(int $tenant, Entitlements $entitlements, UsageCounter $usage): JsonResponse
    {
        $model = Tenant::query()->findOrFail($tenant);
        Entitlements::forget($model->id);
        $e = $entitlements->for($model);

        $data = Tenancy::runAs($model->id, fn () => [
            'subscriptions' => Subscription::query()->orderByDesc('starts_at')->orderByDesc('id')->limit(50)->get()->map(fn (Subscription $s) => [
                'id' => $s->id,
                'plan_key' => $s->plan_key,
                'plan_name' => $s->snapshot['plan_name'] ?? $s->plan_key,
                'period' => $s->period?->value,
                'source' => $s->source->value,
                'status' => $s->status->value,
                'starts_at' => $s->starts_at->toIso8601ZuluString(),
                'ends_at' => $s->ends_at->toIso8601ZuluString(),
                'amount_paid' => Money::toFloat($s->amountPaidCents()),
                'note' => $s->note,
            ])->all(),
            'overrides' => EntitlementOverride::query()->orderBy('entitlement')->get()->map(fn (EntitlementOverride $o) => [
                'entitlement' => $o->entitlement,
                'value' => $o->value,
                'reason' => $o->reason,
                'expires_at' => $o->expires_at?->toIso8601ZuluString(),
            ])->all(),
            'usage' => array_map(fn (PlanLimit $l) => [
                'key' => $l->value,
                'label' => $l->label(),
                'used' => $usage->used($l),
                'limit' => $e->limit($l),
                'unlimited' => $e->isUnlimited($l),
            ], PlanLimit::cases()),
        ]);

        return $this->ok([
            'state' => $e->state->value,
            'plan' => $e->planKey === null ? null : ['key' => $e->planKey, 'name' => $e->planName],
            'period' => $e->period?->value,
            'is_trial' => $e->isTrial,
            'trial_used' => $model->trial_used,
            'ends_at' => $e->endsAt?->toIso8601ZuluString(),
            'grace_ends_at' => $e->graceEndsAt?->toIso8601ZuluString(),
            'features' => array_combine(
                array_map(fn (PlanFeature $f) => $f->value, PlanFeature::cases()),
                array_map(fn (PlanFeature $f) => $e->allows($f), PlanFeature::cases()),
            ),
        ] + $data);
    }

    public function grant(Request $request, int $tenant): JsonResponse
    {
        $data = $request->validate([
            'plan_key' => ['required', 'string', Rule::exists('plans', 'key')],
            'days' => ['required', 'integer', 'between:1,3650'],
            'note' => ['nullable', 'string', 'max:500'],
        ]);
        $model = Tenant::query()->findOrFail($tenant);
        $note = isset($data['note']) ? trim(strip_tags($data['note'])) : null;

        $this->subscriptions->grant($model, $data['plan_key'], (int) $data['days'], $note, $request->user()?->getAuthIdentifier());
        $this->audit->audit('subscription.grant', $model, ['plan_key' => $data['plan_key'], 'days' => (int) $data['days'], 'note' => $note]);

        return $this->show($tenant, app(Entitlements::class), app(UsageCounter::class));
    }

    public function extend(Request $request, int $tenant): JsonResponse
    {
        $data = $request->validate(['days' => ['required', 'integer', 'between:1,3650']]);
        $model = Tenant::query()->findOrFail($tenant);

        $this->subscriptions->extend($model, (int) $data['days']);
        $this->audit->audit('subscription.extend', $model, ['days' => (int) $data['days']]);

        return $this->show($tenant, app(Entitlements::class), app(UsageCounter::class));
    }

    public function setOverride(EntitlementOverrideRequest $request, int $tenant, string $entitlement): JsonResponse
    {
        $model = Tenant::query()->findOrFail($tenant);
        $data = $request->validated();
        $value = $request->isFeature() ? ((bool) $data['value'] ? 1 : 0) : ($data['value'] === null ? null : (int) $data['value']);

        Tenancy::runAs($model->id, fn () => EntitlementOverride::query()->updateOrCreate(['entitlement' => $entitlement], [
            'value' => $value,
            'reason' => trim(strip_tags($data['reason'])),
            'expires_at' => CairoTime::parse($data['expires_at'] ?? null),
            'created_by' => $request->user()?->getAuthIdentifier(),
        ]));
        $this->audit->audit('override.set', $model, ['entitlement' => $entitlement, 'value' => $value, 'reason' => $data['reason']]);
        SyncPlanLocks::dispatch(tenantId: $model->id);

        return $this->show($tenant, app(Entitlements::class), app(UsageCounter::class));
    }

    public function deleteOverride(int $tenant, string $entitlement): Response
    {
        $model = Tenant::query()->findOrFail($tenant);

        Tenancy::runAs($model->id, fn () => EntitlementOverride::query()->where('entitlement', $entitlement)->get()->each->delete());
        $this->audit->audit('override.delete', $model, ['entitlement' => $entitlement]);
        SyncPlanLocks::dispatch(tenantId: $model->id);

        return $this->noContent();
    }
}
