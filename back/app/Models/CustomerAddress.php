<?php

declare(strict_types=1);

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

/**
 * A delivery address a signed-in customer saved (checkout fills it in).
 *
 * @property int $id
 * @property int $customer_id
 * @property string $name
 * @property string $governorate
 * @property string|null $city
 * @property string $address
 * @property bool $is_default
 */
class CustomerAddress extends Model
{
    use BelongsToTenant;

    protected $fillable = ['customer_id', 'name', 'governorate', 'city', 'address', 'is_default'];

    protected function casts(): array
    {
        return ['is_default' => 'boolean'];
    }

    /** @return array<string, mixed> */
    public function toPublic(): array
    {
        return ['id' => $this->id, 'name' => $this->name, 'governorate' => $this->governorate, 'city' => $this->city, 'address' => $this->address, 'is_default' => $this->is_default];
    }
}
