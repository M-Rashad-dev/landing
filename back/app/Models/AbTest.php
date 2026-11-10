<?php

declare(strict_types=1);

namespace App\Models;

use App\Enums\AbTestStatus;
use App\Models\Concerns\BelongsToTenant;
use App\Models\Concerns\LockableByPlan;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property string $name
 * @property int $page_a_id
 * @property int $page_b_id
 * @property int $split_a
 * @property AbTestStatus $status
 * @property int|null $winner_page_id
 * @property Carbon $started_at
 * @property Carbon|null $ended_at
 * @property Carbon $created_at
 */
class AbTest extends Model
{
    use BelongsToTenant, LockableByPlan;

    protected $fillable = ['name', 'page_a_id', 'page_b_id', 'split_a', 'status', 'winner_page_id', 'started_at', 'ended_at'];

    protected function casts(): array
    {
        return ['status' => AbTestStatus::class, 'split_a' => 'integer', 'started_at' => 'datetime', 'ended_at' => 'datetime'];
    }

    /** @return BelongsTo<LandingPage, $this> */
    public function pageA(): BelongsTo
    {
        return $this->belongsTo(LandingPage::class, 'page_a_id');
    }

    /** @return BelongsTo<LandingPage, $this> */
    public function pageB(): BelongsTo
    {
        return $this->belongsTo(LandingPage::class, 'page_b_id');
    }

    public function hasPage(int $pageId): bool
    {
        return $this->page_a_id === $pageId || $this->page_b_id === $pageId;
    }
}
