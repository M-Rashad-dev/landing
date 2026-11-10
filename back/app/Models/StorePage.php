<?php

declare(strict_types=1);

namespace App\Models;

use App\Jobs\RevalidateTenantHosts;
use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

/**
 * A plain store page at /pages/{slug} (about us, shipping, return policy…). Body is Markdown,
 * rendered with the same safe renderer as product descriptions.
 *
 * @property int $id
 * @property int $tenant_id
 * @property string $title
 * @property string $slug
 * @property string|null $body
 * @property bool $is_published
 * @property array<string, mixed>|null $seo
 * @property int $position
 */
class StorePage extends Model
{
    use BelongsToTenant;

    protected $fillable = ['title', 'slug', 'body', 'is_published', 'seo', 'position'];

    protected function casts(): array
    {
        return ['is_published' => 'boolean', 'seo' => 'array', 'position' => 'integer'];
    }

    protected static function booted(): void
    {
        static::saved(fn (StorePage $page) => RevalidateTenantHosts::dispatch($page->tenant_id)->afterCommit());
        static::deleted(fn (StorePage $page) => RevalidateTenantHosts::dispatch($page->tenant_id)->afterCommit());
    }
}
