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
 * @property string|null $slug
 * @property string|null $short_description
 * @property bool $in_store
 * @property bool $is_featured
 * @property string $stock_mode unlimited | product | variant
 * @property int|null $stock
 * @property int|null $low_stock_threshold
 * @property array<string, mixed>|null $seo
 */
class Product extends Model
{
    /** @use HasFactory<ProductFactory> */
    use BelongsToTenant, HasFactory, LockableByPlan, SoftDeletes;

    public const STOCK_UNLIMITED = 'unlimited';

    public const STOCK_PRODUCT = 'product';

    public const STOCK_VARIANT = 'variant';

    protected $fillable = [
        'name', 'slug', 'description', 'short_description', 'price', 'compare_at_price', 'sku', 'is_active',
        'in_store', 'is_featured', 'stock_mode', 'stock', 'low_stock_threshold', 'seo',
    ];

    protected function casts(): array
    {
        return [
            'price' => 'decimal:2',
            'compare_at_price' => 'decimal:2',
            'is_active' => 'boolean',
            'in_store' => 'boolean',
            'is_featured' => 'boolean',
            'stock' => 'integer',
            'low_stock_threshold' => 'integer',
            'seo' => 'array',
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

    /** @return BelongsToMany<Category, $this> */
    public function categories(): BelongsToMany
    {
        return $this->belongsToMany(Category::class)->orderBy('position')->orderBy('id');
    }

    /** @return HasMany<ProductVariant, $this> */
    public function variants(): HasMany
    {
        return $this->hasMany(ProductVariant::class)->orderBy('id');
    }

    /** Something can still be ordered (any unit left, or stock not tracked). */
    public function inStock(): bool
    {
        return match ($this->stock_mode) {
            self::STOCK_PRODUCT => (int) $this->stock > 0,
            self::STOCK_VARIANT => $this->relationLoaded('variants') ? $this->variants->contains(fn ($v) => $v->stock > 0) : $this->variants()->where('stock', '>', 0)->exists(),
            default => true,
        };
    }

    /** @return HasMany<OrderItem, $this> */
    public function orderItems(): HasMany
    {
        return $this->hasMany(OrderItem::class);
    }

    public function tracksStock(): bool
    {
        return $this->stock_mode === self::STOCK_PRODUCT || $this->stock_mode === self::STOCK_VARIANT;
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
