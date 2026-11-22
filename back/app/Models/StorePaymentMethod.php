<?php

declare(strict_types=1);

namespace App\Models;

use App\Enums\StorePaymentKind;
use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

/**
 * A store's own way to be paid before delivery: where the customer sends the money (an InstaPay address, a wallet
 * number, a bank account, or a payment link) and what to do; then he uploads the receipt.
 *
 * @property int $id
 * @property int $tenant_id
 * @property StorePaymentKind $kind
 * @property string $name
 * @property string|null $account number / address / IBAN the customer pays to
 * @property string|null $link https only (an InstaPay link or the store's payment page)
 * @property string|null $instructions
 * @property bool $is_active
 * @property int $position
 */
class StorePaymentMethod extends Model
{
    use BelongsToTenant;

    public const MAX = 10;

    protected $fillable = ['kind', 'name', 'account', 'link', 'instructions', 'is_active', 'position'];

    protected function casts(): array
    {
        return ['kind' => StorePaymentKind::class, 'is_active' => 'boolean', 'position' => 'integer'];
    }

    /** What a customer sees to pay (checkout list and the pay page). @return array<string, mixed> */
    public function publicView(): array
    {
        return [
            'id' => $this->id,
            'kind' => $this->kind->value,
            'name' => $this->name,
            'account' => $this->account,
            'link' => $this->link,
            'instructions' => $this->instructions,
        ];
    }
}
