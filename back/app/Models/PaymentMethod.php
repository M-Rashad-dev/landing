<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;

/**
 * How merchants pay the platform (platform table). A manual method is shown only when it is
 * active and has the account to transfer to (InstaPay address, wallet number).
 *
 * @property string $key
 * @property string $name
 * @property string $kind
 * @property string|null $account_label
 * @property string|null $account_value
 * @property string|null $instructions
 * @property bool $is_active
 * @property int $sort_order
 */
class PaymentMethod extends Model
{
    protected $primaryKey = 'key';

    protected $keyType = 'string';

    public $incrementing = false;

    protected $fillable = ['key', 'name', 'kind', 'account_label', 'account_value', 'instructions', 'is_active', 'sort_order'];

    protected function casts(): array
    {
        return ['is_active' => 'boolean', 'sort_order' => 'integer'];
    }

    /** Methods a merchant can use now. @param Builder<PaymentMethod> $query */
    public function scopeUsable(Builder $query): void
    {
        $query->where('is_active', true)->whereNotNull('account_value')->where('account_value', '!=', '')->orderBy('sort_order')->orderBy('key');
    }
}
