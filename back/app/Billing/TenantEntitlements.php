<?php

declare(strict_types=1);

namespace App\Billing;

use App\Enums\AccessState;
use App\Enums\BillingPeriod;
use App\Enums\PlanFeature;
use App\Enums\PlanLimit;
use Carbon\CarbonImmutable;

/**
 * What one tenant may do right now: its access state, its plan and the final value of every
 * feature and limit (plan values, then admin overrides, then the platform safety caps).
 * Unknown or missing values are closed (false / 0).
 */
final readonly class TenantEntitlements
{
    /**
     * @param  array<string, bool>  $features
     * @param  array<string, int|null>  $limits  null = unlimited (up to the safety cap)
     */
    public function __construct(
        public int $tenantId,
        public AccessState $state,
        public ?string $planKey,
        public ?string $planName,
        public ?BillingPeriod $period,
        public ?CarbonImmutable $endsAt,
        public ?CarbonImmutable $graceEndsAt,
        public bool $isTrial,
        private array $features,
        private array $limits,
    ) {}

    public function isOpen(): bool
    {
        return $this->state->isOpen();
    }

    public function allows(PlanFeature $feature): bool
    {
        return $this->isOpen() && ($this->features[$feature->value] ?? false);
    }

    /** The plan's number, or null when unlimited. Expired = 0. */
    public function planLimit(PlanLimit $limit): ?int
    {
        if (! $this->isOpen()) {
            return 0;
        }

        return array_key_exists($limit->value, $this->limits) ? $this->limits[$limit->value] : 0;
    }

    /** The number actually enforced: the plan's value under the safety cap. */
    public function limit(PlanLimit $limit): int
    {
        $value = $this->planLimit($limit);
        $cap = $limit->safetyCap();

        return $value === null ? $cap : min($value, $cap);
    }

    public function isUnlimited(PlanLimit $limit): bool
    {
        return $this->planLimit($limit) === null;
    }
}
