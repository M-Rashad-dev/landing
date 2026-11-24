<?php

declare(strict_types=1);

namespace App\Models;

use App\Enums\DeliveryType;
use App\Models\Concerns\BelongsToTenant;
use App\Models\Concerns\LockableByPlan;
use App\Support\Money;
use Database\Factories\ProductFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
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
 * @property string|null $cost what one unit costs the store (null = not set)
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
 * @property int|null $primary_category_id
 * @property string $kind physical | digital
 * @property DeliveryType|null $delivery_type digital only
 * @property array{downloads?: int|null, link?: string, opens?: int|null, subject?: string|null, message?: string|null}|null $delivery_settings
 */
class Product extends Model
{
    /** @use HasFactory<ProductFactory> */
    use BelongsToTenant, HasFactory, LockableByPlan, SoftDeletes;

    public const STOCK_UNLIMITED = 'unlimited';

    public const STOCK_PRODUCT = 'product';

    public const STOCK_VARIANT = 'variant';

    public const PHYSICAL = 'physical';

    public const DIGITAL = 'digital';

    protected $fillable = [
        'name', 'slug', 'description', 'short_description', 'price', 'compare_at_price', 'sku', 'is_active',
        'in_store', 'is_featured', 'stock_mode', 'stock', 'low_stock_threshold', 'seo',
        'kind', 'delivery_type', 'delivery_settings', 'cost',
    ];

    protected $hidden = ['delivery_settings'];

    protected function casts(): array
    {
        return [
            'price' => 'decimal:2',
            'compare_at_price' => 'decimal:2',
            'cost' => 'decimal:2',
            'is_active' => 'boolean',
            'in_store' => 'boolean',
            'is_featured' => 'boolean',
            'stock' => 'integer',
            'low_stock_threshold' => 'integer',
            'seo' => 'array',
            'delivery_type' => DeliveryType::class,
            // Holds the protected link of link products: encrypted, never on public pages.
            'delivery_settings' => 'encrypted:array',
        ];
    }

    public function isDigital(): bool
    {
        return $this->kind === self::DIGITAL && $this->delivery_type !== null;
    }

    /** Sells entries from its codes list (their uses left are its stock). */
    public function deliversCodes(): bool
    {
        return $this->isDigital() && $this->delivery_type === DeliveryType::Codes;
    }

    /** @return HasMany<ProductFile, $this> */
    public function files(): HasMany
    {
        return $this->hasMany(ProductFile::class)->orderBy('position')->orderBy('id');
    }

    /** @return HasMany<ProductCode, $this> */
    public function codes(): HasMany
    {
        return $this->hasMany(ProductCode::class);
    }

    /** @return HasMany<ProductOption, $this> */
    public function options(): HasMany
    {
        return $this->hasMany(ProductOption::class)->orderBy('position')->orderBy('id');
    }

    /** «حسب الطلب» fields the customer fills when buying (no variants). @return HasMany<ProductInput, $this> */
    public function inputs(): HasMany
    {
        return $this->hasMany(ProductInput::class)->orderBy('position')->orderBy('id');
    }

    /** Something must be typed or uploaded before it can be bought (no quick add, gift or one-click upsell). */
    public function needsChoices(): bool
    {
        return $this->options->contains(fn (ProductOption $o) => $o->is_required) || $this->inputs->contains(fn (ProductInput $i) => $i->is_required);
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

    /** @return BelongsToMany<ShippingOffer, $this> */
    public function shippingOffers(): BelongsToMany
    {
        return $this->belongsToMany(ShippingOffer::class, 'shipping_offer_products');
    }

    /** The main category among its categories (breadcrumb, SEO). @return BelongsTo<Category, $this> */
    public function primaryCategory(): BelongsTo
    {
        return $this->belongsTo(Category::class, 'primary_category_id');
    }

    /** @return HasMany<ProductVariant, $this> */
    public function variants(): HasMany
    {
        return $this->hasMany(ProductVariant::class)->orderBy('id');
    }

    /** Something can still be ordered (any unit left, or stock not tracked). */
    public function inStock(): bool
    {
        if ($this->deliversCodes()) {
            return $this->codes()->where('uses_left', '>', 0)->exists();
        }

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

    /** @return HasMany<ProductReview, $this> */
    public function reviews(): HasMany
    {
        return $this->hasMany(ProductReview::class);
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
