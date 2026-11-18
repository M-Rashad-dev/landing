<?php

declare(strict_types=1);

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use App\Support\Money;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;

/**
 * A store's AI balance (App\Ai\AiWallets moves it): «paid» from top-ups, «free» from the welcome
 * credit and the owner's gifts.
 *
 * @property int $id
 * @property int $tenant_id
 * @property string $paid_balance
 * @property string $free_balance
 * @property bool $welcomed
 * @property Carbon|null $low_notified_at
 */
class AiWallet extends Model
{
    use BelongsToTenant;

    protected $fillable = ['paid_balance', 'free_balance', 'welcomed', 'low_notified_at'];

    protected function casts(): array
    {
        return ['welcomed' => 'boolean', 'low_notified_at' => 'datetime'];
    }

    public function paidCents(): int
    {
        return Money::toCents((string) $this->paid_balance);
    }

    public function freeCents(): int
    {
        return Money::toCents((string) $this->free_balance);
    }
}
