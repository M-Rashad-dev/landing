<?php

declare(strict_types=1);

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

/**
 * Daily store traffic counters (written by the public store events endpoint with an atomic upsert).
 *
 * @property string $date
 * @property string $source
 * @property string $device
 * @property int $views
 * @property int $product_views
 * @property int $add_to_cart
 * @property int $checkouts
 */
class StoreStat extends Model
{
    use BelongsToTenant;

    public $timestamps = false;

    protected $fillable = [];

    protected $casts = ['date' => 'immutable_date:Y-m-d'];
}
