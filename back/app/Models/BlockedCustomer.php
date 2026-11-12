<?php

declare(strict_types=1);

namespace App\Models;

use App\Enums\BlockType;
use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

/**
 * A phone number (E.164) or IP address whose orders are rejected with the generic message.
 *
 * @property int $id
 * @property BlockType $type
 * @property string $value
 * @property string|null $reason
 * @property string|null $rule null = blocked by the merchant, else App\Actions\Orders\AutoBlock's rule
 */
class BlockedCustomer extends Model
{
    use BelongsToTenant;

    protected $fillable = ['type', 'value', 'reason', 'rule'];

    protected function casts(): array
    {
        return ['type' => BlockType::class];
    }

    public static function isBlocked(?string $phone, ?string $ip): bool
    {
        return self::query()
            ->where(function ($query) use ($phone, $ip): void {
                $query->where(fn ($q) => $q->where('type', BlockType::Phone)->where('value', (string) $phone));
                if ($ip !== null && $ip !== '') {
                    $query->orWhere(fn ($q) => $q->where('type', BlockType::Ip)->where('value', $ip));
                }
            })
            ->exists();
    }
}
