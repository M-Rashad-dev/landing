<?php

declare(strict_types=1);

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Database\Factories\MediaFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

/**
 * @property int $id
 * @property int $tenant_id
 * @property string $disk
 * @property string $path
 * @property array<string, string> $variants
 * @property string $original_name
 * @property string $mime
 * @property int $size_bytes
 * @property int $width
 * @property int $height
 * @property string|null $alt
 */
class Media extends Model
{
    /** @use HasFactory<MediaFactory> */
    use BelongsToTenant, HasFactory;

    protected $table = 'media';

    protected $fillable = [
        'tenant_id', 'disk', 'path', 'variants', 'original_name', 'mime', 'size_bytes', 'width', 'height', 'alt',
    ];

    protected function casts(): array
    {
        return [
            'variants' => 'array',
            'size_bytes' => 'integer',
            'width' => 'integer',
            'height' => 'integer',
        ];
    }

    /**
     * Public URLs (relative; Caddy serves /media/* from the volume).
     *
     * @return array<string, string>
     */
    public function urls(): array
    {
        $urls = [];

        foreach ($this->variants as $variant => $path) {
            $urls[$variant] = self::url($path);
        }

        return $urls;
    }

    public static function url(string $relativePath): string
    {
        return '/media/'.ltrim($relativePath, '/');
    }

    /** @return list<string> */
    public function allPaths(): array
    {
        return array_values(array_unique(array_filter([$this->path, ...array_values($this->variants)])));
    }
}
