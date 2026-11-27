<?php

declare(strict_types=1);

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

/**
 * «اختبار البشرة»: visitors who got a result on a day (an atomic upsert from the public store).
 *
 * @property string $section_id
 * @property string $result_id
 * @property string $date
 * @property int $count
 * @property int $ai_count
 */
class StoreQuizResult extends Model
{
    use BelongsToTenant;

    public $timestamps = false;

    protected $fillable = [];

    protected $casts = ['date' => 'immutable_date:Y-m-d', 'count' => 'integer', 'ai_count' => 'integer'];
}
