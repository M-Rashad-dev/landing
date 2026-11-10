<?php

declare(strict_types=1);

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use App\Models\Concerns\LockableByPlan;
use App\Support\Money;
use Database\Factories\ProductFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * @property int $id
 * @property int $tenant_id
 * @property string $name
 * @property string|null $description
 * @property string $price decimal string
 * @property string|null $compare_at_price decimal string
 * @property string|null $sku
 * @property bool $is_active
 */
class Product extends Model
{
    /** @use HasFactory<ProductFactory> */
    use BelongsToTenant, HasFactory, LockableByPlan, SoftDeletes;

    protected $fillable = ['name', 'description', 'price', 'compare_at_price', 'sku', 'is_active'];

    protected function casts(): array
    {
        return [
            'price' => 'decimal:2',
            'compare_at_price' => 'decimal:2',
            'is_active' => 'boolean',
        ];
    }

    /** @return HasMany<ProductOption, $this> */
    public function options(): HasMany
    {
        return $this->hasMany(ProductOption::class)->orderBy('position')->orderBy('id');
    }

    /** @return BelongsToMany<Media, $this> */
    public function media(): BelongsToMany
    {
        return $this->belongsToMany(Media::class, 'product_media')
            ->withPivot('position')
            ->orderBy('product_media.position')
            ->orderBy('product_media.id');
    }

    public function priceCents(): int
    {
        return Money::toCents($this->price);
    }

    public function compareAtCents(): ?int
    {
        return $this->compare_at_price === null ? null : Money::toCents($this->compare_at_price);
    }
}
