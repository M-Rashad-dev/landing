<?php

declare(strict_types=1);

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;

/**
 * How a store looks with one theme: its home sections and theme settings, as a draft the
 * merchant edits in the Builder and the published copy visitors get.
 *
 * @property int $id
 * @property string $theme_key
 * @property array{settings: array<string, mixed>, sections: list<array<string, mixed>>} $draft
 * @property array{settings: array<string, mixed>, sections: list<array<string, mixed>>}|null $published
 * @property Carbon|null $published_at
 * @property int $version
 */
class StoreDesign extends Model
{
    use BelongsToTenant;

    protected $fillable = ['theme_key', 'draft', 'published', 'published_at', 'version'];

    protected function casts(): array
    {
        return ['draft' => 'array', 'published' => 'array', 'published_at' => 'datetime', 'version' => 'integer'];
    }

    public function hasUnpublishedChanges(): bool
    {
        return $this->published === null || $this->published !== $this->draft;
    }
}
