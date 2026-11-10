<?php

declare(strict_types=1);

namespace Database\Factories;

use App\Enums\SubscriptionSource;
use App\Enums\TenantStatus;
use App\Models\Subscription;
use App\Models\Tenant;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * Tenants start on a running "max" plan (every feature on) so tests of other features are not
 * limited by plans; use onPlan() / expired() / withoutPlan() to test plans themselves.
 *
 * @extends Factory<Tenant>
 */
class TenantFactory extends Factory
{
    protected $model = Tenant::class;

    /** @return array<string, mixed> */
    public function definition(): array
    {
        return [
            'name' => fake()->company(),
            'status' => TenantStatus::Active,
        ];
    }

    public function configure(): static
    {
        return $this->afterCreating(function (Tenant $tenant): void {
            // onPlan() / expired() set plan_key / plan_ends_at; the default is a running "max".
            $plan = $tenant->plan_key ?? 'max';
            $expired = $tenant->plan_ends_at !== null && $tenant->plan_ends_at->isPast();
            [$starts, $ends] = $expired ? [now()->subDays(40), now()->subDays(10)] : [now()->subDay(), now()->addDays(30)];

            Subscription::query()->create([
                'tenant_id' => $tenant->id,
                'plan_key' => $plan,
                'source' => SubscriptionSource::AdminGrant,
                'starts_at' => $starts,
                'ends_at' => $ends,
            ]);

            $tenant->forceFill([
                'plan_key' => $plan,
                'plan_source' => SubscriptionSource::AdminGrant,
                'plan_ends_at' => $ends,
                'plan_grace_ends_at' => $ends->copy()->addHours(24),
                'plan_next_check_at' => $expired ? null : $ends,
                'plan_state' => $expired ? 'closed' : 'open',
            ])->saveQuietly();
        });
    }

    public function onPlan(string $planKey): static
    {
        return $this->state(fn () => ['plan_key' => $planKey]);
    }

    /** Last plan ended 10 days ago: sites closed, dashboard read-only. */
    public function expired(string $planKey = 'max'): static
    {
        return $this->state(fn () => ['plan_key' => $planKey, 'plan_ends_at' => now()->subDays(10)]);
    }

    /** Never had a subscription (sign-up with the trial off). Runs after the default plan. */
    public function withoutPlan(): static
    {
        return $this->afterCreating(function (Tenant $tenant): void {
            Subscription::query()->where('tenant_id', $tenant->id)->withoutGlobalScopes()->delete();
            $tenant->forceFill([
                'plan_key' => null, 'plan_source' => null, 'plan_ends_at' => null,
                'plan_grace_ends_at' => null, 'plan_next_check_at' => null, 'plan_state' => 'closed',
            ])->saveQuietly();
        });
    }

    public function suspended(): static
    {
        return $this->state(fn () => [
            'status' => TenantStatus::Suspended,
            'suspended_at' => now(),
            'suspended_reason' => 'test',
        ]);
    }
}
