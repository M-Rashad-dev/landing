<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * A piece of a knowledge-base article with its vector (App\Ai\Knowledge cuts and searches them).
 *
 * @property int $id
 * @property int $ai_article_id
 * @property int $position
 * @property string $text
 * @property list<float>|null $embedding
 * @property string|null $model
 */
class AiArticleChunk extends Model
{
    protected $fillable = ['ai_article_id', 'position', 'text', 'embedding', 'model'];

    protected function casts(): array
    {
        return ['embedding' => 'array', 'position' => 'integer'];
    }

    /** @return BelongsTo<AiArticle, $this> */
    public function article(): BelongsTo
    {
        return $this->belongsTo(AiArticle::class, 'ai_article_id');
    }
}
