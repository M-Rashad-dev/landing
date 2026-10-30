<?php

declare(strict_types=1);

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

/**
 * Daily visit counters of a page (written by RecordPageEvent with an atomic upsert).
 *
 * @property int $landing_page_id
 * @property int $ab_test_id
 * @property string $date
 * @property string $source
 * @property string $device
 * @property int $views
 * @property int $form_starts
 */
class PageStat extends Model
{
    use BelongsToTenant;

    public $timestamps = false;

    protected $fillable = [];
}
