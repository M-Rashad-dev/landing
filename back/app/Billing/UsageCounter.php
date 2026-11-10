<?php

declare(strict_types=1);

namespace App\Billing;

use App\Enums\AbTestStatus;
use App\Enums\DomainType;
use App\Enums\PlanLimit;
use App\Models\AbTest;
use App\Models\DiscountCode;
use App\Models\Domain;
use App\Models\LandingPage;
use App\Models\Media;
use App\Models\Offer;
use App\Models\Product;
use App\Models\Webhook;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;

/**
 * How much of each limit the current tenant uses (tenant scope applies: run inside a tenant
 * context). The same queries pick the rows that get locked after a downgrade (PlanLocks).
 */
final class UsageCounter
{
    private const BYTES_PER_MB = 1048576;

    public function used(PlanLimit $limit): int
    {
        if ($limit === PlanLimit::MediaStorageMb) {
            return (int) ceil($this->mediaBytes() / self::BYTES_PER_MB);
        }

        return $this->rows($limit)->count();
    }

    public function mediaBytes(): int
    {
        return (int) Media::query()->sum('size_bytes');
    }

    /**
     * The rows a limit counts. Not for media storage (that one is a sum).
     *
     * @return Builder<covariant Model>
     */
    public function rows(PlanLimit $limit): Builder
    {
        return match ($limit) {
            PlanLimit::Products => Product::query(),
            PlanLimit::LandingPages => LandingPage::query(),
            PlanLimit::CustomDomains => Domain::query()->where('type', DomainType::Custom),
            PlanLimit::Offers => Offer::query(),
            PlanLimit::DiscountCodes => DiscountCode::query(),
            PlanLimit::Webhooks => Webhook::query(),
            PlanLimit::AbTests => AbTest::query()->where('status', AbTestStatus::Running),
            PlanLimit::MediaStorageMb => throw new \LogicException('Media storage is a sum, not rows.'),
        };
    }
}
