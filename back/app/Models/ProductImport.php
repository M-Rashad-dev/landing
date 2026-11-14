<?php

declare(strict_types=1);

namespace App\Models;

use App\Enums\ImportStatus;
use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * A product import from an uploaded sheet: its file, the confirmed column mapping, and the
 * counters the queue job updates while it works.
 *
 * @property int $id
 * @property int $tenant_id
 * @property int|null $user_id
 * @property ImportStatus $status
 * @property string $source
 * @property string $file_name
 * @property string|null $file_path
 * @property string $extension
 * @property int $file_size
 * @property list<string> $headers
 * @property int $header_line
 * @property array<string, int|list<int>>|null $mapping
 * @property array<string, mixed>|null $options
 * @property int $total_rows
 * @property int $total_products
 * @property int $processed
 * @property int $created_count
 * @property int $updated_count
 * @property int $skipped_count
 * @property int $failed_count
 * @property int $images_total
 * @property int $images_done
 * @property int $images_failed
 * @property list<string>|null $warnings
 * @property string|null $error
 * @property Carbon|null $started_at
 * @property Carbon|null $finished_at
 * @property Carbon|null $created_at
 */
class ProductImport extends Model
{
    use BelongsToTenant;

    protected $fillable = [
        'user_id', 'status', 'source', 'file_name', 'file_path', 'extension', 'file_size', 'headers', 'header_line', 'mapping', 'options',
        'total_rows', 'total_products', 'processed', 'created_count', 'updated_count', 'skipped_count', 'failed_count',
        'images_total', 'images_done', 'images_failed', 'warnings', 'error', 'started_at', 'finished_at',
    ];

    protected function casts(): array
    {
        return [
            'status' => ImportStatus::class,
            'headers' => 'array',
            'mapping' => 'array',
            'options' => 'array',
            'warnings' => 'array',
            'started_at' => 'datetime',
            'finished_at' => 'datetime',
        ];
    }

    /** @return HasMany<ProductImportFailure, $this> */
    public function failures(): HasMany
    {
        return $this->hasMany(ProductImportFailure::class)->orderBy('row_number')->orderBy('id');
    }

    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function option(string $key, mixed $default = null): mixed
    {
        return $this->options[$key] ?? $default;
    }
}
