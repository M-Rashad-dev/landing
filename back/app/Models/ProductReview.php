<?php

declare(strict_types=1);

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * A product review by a customer who received the product. Published at once; the merchant can hide it.
 *
 * @property int $id
 * @property int $product_id
 * @property int $customer_id
 * @property int|null $order_id
 * @property int $rating 1..5
 * @property string|null $text
 * @property string $author_name
 * @property bool $is_hidden
 * @property Carbon $created_at
 */
class ProductReview extends Model
{
    use BelongsToTenant;

    protected $fillable = ['product_id', 'customer_id', 'order_id', 'rating', 'text', 'author_name', 'is_hidden'];

    protected function casts(): array
    {
        return ['rating' => 'integer', 'is_hidden' => 'boolean'];
    }

    /** @param Builder<self> $query */
    public function scopeVisible(Builder $query): void
    {
        $query->where('is_hidden', false);
    }

    /** @return BelongsTo<Product, $this> */
    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class)->withTrashed();
    }

    /** @return BelongsTo<Customer, $this> */
    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }

    /** What a visitor sees: the first name only. @return array<string, mixed> */
    public function toPublic(): array
    {
        return [
            'id' => $this->id,
            'name' => self::displayName($this->author_name),
            'rating' => $this->rating,
            'text' => $this->text,
            'verified' => true,
            'created_at' => $this->created_at->toIso8601ZuluString(),
        ];
    }

    /** "سارة محمود" → "سارة م." (visitors never see a full name). */
    public static function displayName(string $name): string
    {
        $parts = preg_split('/\s+/u', trim($name)) ?: [];
        if (count($parts) < 2) {
            return $parts[0] ?? '';
        }

        return $parts[0].' '.mb_substr((string) $parts[1], 0, 1).'.';
    }
}
