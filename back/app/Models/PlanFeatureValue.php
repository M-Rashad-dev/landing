<?php

declare(strict_types=1);

namespace App\Models;

use App\Billing\PlanCatalog;
use Illuminate\Database\Eloquent\Model;

/**
 * One feature (0 / 1) or limit (number, null = unlimited) of a plan.
 *
 * @property int $id
 * @property string $plan_key
 * @property string $entitlement
 * @property int|null $value
 */
class PlanFeatureValue extends Model
{
    protected $fillable = ['plan_key', 'entitlement', 'value'];

    protected function casts(): array
    {
        return ['value' => 'integer'];
    }

    protected static function booted(): void
    {
        static::saved(fn () => PlanCatalog::flush());
        static::deleted(fn () => PlanCatalog::flush());
    }
}
