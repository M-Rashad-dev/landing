<?php

declare(strict_types=1);

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;

/**
 * One move of a store's AI balance.
 *
 * @property int $id
 * @property int $tenant_id
 * @property string $type topup | bonus | welcome | gift | charge | adjust
 * @property string $amount signed
 * @property string $paid_change
 * @property string $free_change
 * @property string $balance_after
 * @property string|null $feature
 * @property string|null $description
 * @property int|null $invoice_id
 * @property int|null $ai_usage_id
 * @property int|null $admin_id
 * @property Carbon $created_at
 */
class AiWalletEntry extends Model
{
    use BelongsToTenant;

    public const UPDATED_AT = null;

    public const TYPES = ['topup', 'bonus', 'welcome', 'gift', 'charge', 'adjust'];

    protected $fillable = ['type', 'amount', 'paid_change', 'free_change', 'balance_after', 'feature', 'description', 'invoice_id', 'ai_usage_id', 'admin_id'];

    protected function casts(): array
    {
        return ['created_at' => 'datetime'];
    }
}
