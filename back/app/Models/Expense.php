<?php

declare(strict_types=1);

namespace App\Models;

use App\Enums\ExpenseKind;
use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;

/**
 * A store expense outside the orders (ad spend, salaries, rent…), counted in the profit of its day.
 *
 * @property int $id
 * @property Carbon $spent_on
 * @property ExpenseKind $kind
 * @property string $amount
 * @property string|null $note
 * @property int|null $created_by
 */
class Expense extends Model
{
    use BelongsToTenant;

    protected $fillable = ['spent_on', 'kind', 'amount', 'note', 'created_by'];

    protected function casts(): array
    {
        return ['spent_on' => 'date', 'kind' => ExpenseKind::class, 'amount' => 'decimal:2'];
    }
}
