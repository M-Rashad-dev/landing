<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * An article of the support assistant's knowledge base (written by the owner in the admin). A
 * platform table: the same knowledge for every store.
 *
 * @property int $id
 * @property string $title
 * @property string $category
 * @property string $body
 * @property bool $is_active
 * @property int|null $updated_by
 * @property Carbon|null $embedded_at
 * @property string|null $embed_error
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
class AiArticle extends Model
{
    /** The sections of the knowledge base (admin filter and the assistant's hint). */
    public const CATEGORIES = ['start', 'products', 'orders', 'shipping', 'store', 'landing', 'design', 'domain', 'marketing', 'billing', 'account', 'other'];

    protected $fillable = ['title', 'category', 'body', 'is_active', 'updated_by', 'embedded_at', 'embed_error'];

    protected function casts(): array
    {
        return ['is_active' => 'boolean', 'embedded_at' => 'datetime'];
    }

    /** @return HasMany<AiArticleChunk, $this> */
    public function chunks(): HasMany
    {
        return $this->hasMany(AiArticleChunk::class)->orderBy('position');
    }
}
