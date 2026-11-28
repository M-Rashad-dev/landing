<?php

declare(strict_types=1);

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * A visitor's question on a product («أسئلة العملاء»). Shown on the product page only once the merchant answered it
 * and published it; the phone is for the merchant only (never the storefront nor the copilot).
 *
 * @property int $id
 * @property int $tenant_id
 * @property int $product_id
 * @property string $name
 * @property string|null $phone
 * @property string $question
 * @property string|null $answer
 * @property Carbon|null $answered_at
 * @property bool $is_published
 * @property Carbon $created_at
 */
class ProductQuestion extends Model
{
    use BelongsToTenant;

    protected $fillable = ['product_id', 'name', 'phone', 'question', 'answer', 'answered_at', 'is_published'];

    protected function casts(): array
    {
        return ['answered_at' => 'datetime', 'is_published' => 'boolean'];
    }

    /** What visitors see: answered and published. @param Builder<self> $query */
    public function scopePublished(Builder $query): void
    {
        $query->where('is_published', true)->whereNotNull('answered_at');
    }

    /** @return BelongsTo<Product, $this> */
    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class)->withTrashed();
    }

    /** «لسه مستني رد» / «منشور» / «مخفي». */
    public function status(): string
    {
        return match (true) {
            $this->answered_at === null => 'unanswered',
            $this->is_published => 'published',
            default => 'hidden',
        };
    }

    /** What a visitor sees: the asker's first name only, the question and the store's answer. @return array<string, mixed> */
    public function toPublic(): array
    {
        return [
            'id' => $this->id,
            'name' => ProductReview::displayName($this->name),
            'question' => $this->question,
            'answer' => (string) $this->answer,
            'answered_at' => $this->answered_at?->toIso8601ZuluString(),
        ];
    }
}
