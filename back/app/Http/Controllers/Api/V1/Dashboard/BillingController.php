<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Dashboard;

use App\Billing\Entitlements;
use App\Billing\PlanLocks;
use App\Billing\PlanPresenter;
use App\Billing\SubscriptionManager;
use App\Billing\UsageCounter;
use App\Enums\PlanLimit;
use App\Enums\SubscriptionSource;
use App\Http\Controllers\Concerns\RespondsWithJson;
use App\Http\Controllers\Controller;
use App\Http\Requests\Dashboard\ChoosePlanLocksRequest;
use App\Models\Subscription;
use App\Models\Tenant;
use App\Models\User;
use App\Support\Money;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** «الباقة والاشتراك»: what the store may do, how much it uses, the plans it can move to. */
final class BillingController extends Controller
{
    use RespondsWithJson;

    public function __construct(
        private readonly Entitlements $entitlements,
        private readonly UsageCounter $usage,
        private readonly SubscriptionManager $subscriptions,
    ) {}

    /** Cheap (no counting); the layout gets the same object from /auth/me. */
    public function entitlements(): JsonResponse
    {
        return $this->ok(PlanPresenter::entitlements($this->entitlements->current()));
    }

    /** Counting queries: the plan page reads all, list pages ask for their own (?keys=products). */
    public function usage(Request $request, PlanLocks $locks): JsonResponse
    {
        $request->validate(['keys' => ['nullable', 'string', 'max:200']]);
        $wanted = array_filter(explode(',', (string) $request->query('keys', '')));
        $e = $this->entitlements->current();
        $lockable = array_map(fn (PlanLimit $l) => $l->value, $locks->lockableLimits());

        $rows = [];
        foreach (PlanLimit::cases() as $limit) {
            if ($wanted !== [] && ! in_array($limit->value, $wanted, true)) {
                continue;
            }
            $rows[] = [
                'key' => $limit->value,
                'label' => $limit->label(),
                'used' => $this->usage->used($limit),
                'limit' => $e->limit($limit),
                'unlimited' => $e->isUnlimited($limit),
                'locked' => in_array($limit->value, $lockable, true) ? $this->usage->rows($limit)->where('locked_by_plan', true)->count() : 0,
            ];
        }

        return $this->ok($rows);
    }

    public function plans(Request $request, PlanPresenter $presenter): JsonResponse
    {
        $tenant = $this->tenant($request);

        return $this->ok($presenter->pricing($this->subscriptions->current($tenant), $tenant->plan_key, $tenant->plan_period), [
            'entitlements' => PlanPresenter::entitlementCatalog(),
        ]);
    }

    public function subscriptions(): JsonResponse
    {
        $rows = Subscription::query()->with('plan:key,name')->orderByDesc('starts_at')->orderByDesc('id')->limit(50)->get();

        return $this->ok($rows->map(fn (Subscription $s) => [
            'id' => $s->id,
            'plan' => ['key' => $s->plan_key, 'name' => $s->plan->name ?? ($s->snapshot['plan_name'] ?? $s->plan_key)],
            'period' => $s->period?->value,
            'source' => $s->source->value,
            'status' => $s->status->value,
            'starts_at' => $s->starts_at->toIso8601ZuluString(),
            'ends_at' => $s->ends_at->toIso8601ZuluString(),
            'amount_paid' => Money::toFloat($s->amountPaidCents()),
            'is_trial' => $s->source === SubscriptionSource::Trial,
        ])->all());
    }

    /** Rows of one limit with their lock, for «choose what stays live». */
    public function lockRows(string $limit): JsonResponse
    {
        $key = $this->lockable($limit);
        $label = match ($key) {
            PlanLimit::Products, PlanLimit::Offers, PlanLimit::Webhooks, PlanLimit::AbTests, PlanLimit::StoreCategories => 'name',
            PlanLimit::LandingPages => 'title',
            PlanLimit::CustomDomains => 'host',
            PlanLimit::DiscountCodes => 'code',
            PlanLimit::MediaStorageMb => 'id',
        };

        $rows = $this->usage->rows($key)
            ->orderBy('locked_by_plan')
            ->orderByDesc('updated_at')
            ->orderByDesc('id')
            ->get(['id', $label, 'locked_by_plan', 'updated_at']);

        return $this->ok($rows->map(fn (Model $row) => [
            'id' => $row->getKey(),
            'label' => (string) $row->getAttribute($label),
            'locked' => (bool) $row->getAttribute('locked_by_plan'),
            'updated_at' => $row->getAttribute('updated_at')?->toIso8601ZuluString(),
        ])->all(), ['limit' => $this->entitlements->current()->limit($key)]);
    }

    public function chooseLocks(ChoosePlanLocksRequest $request, string $limit, PlanLocks $locks): JsonResponse
    {
        $locks->choose($this->tenant($request), $this->lockable($limit), array_map('intval', $request->validated('active_ids')));

        return $this->lockRows($limit);
    }

    private function lockable(string $limit): PlanLimit
    {
        $key = PlanLimit::tryFrom($limit);
        abort_if($key === null || ! $key->locksRows(), 404);

        return $key;
    }

    private function tenant(Request $request): Tenant
    {
        /** @var User $user */
        $user = $request->user();

        return $user->tenant ?? abort(403);
    }
}
