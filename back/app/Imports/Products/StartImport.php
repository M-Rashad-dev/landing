<?php

declare(strict_types=1);

namespace App\Imports\Products;

use App\Enums\ImportStatus;
use App\Exceptions\ApiException;
use App\Jobs\ProcessProductImport;
use App\Models\ProductImport;
use App\Tenancy\Tenancy;

/**
 * Queues an uploaded sheet with its confirmed mapping and options (validated by ProductImportStartRequest): one import
 * at a time per store. Used by the import page and the store copilot.
 */
final class StartImport
{
    /**
     * @param  array<string, int|list<int>>  $mapping
     * @param  array<string, mixed>  $options
     */
    public function handle(ProductImport $import, array $mapping, array $options): ProductImport
    {
        if ($import->status !== ImportStatus::Uploaded || $import->file_path === null) {
            throw ApiException::conflict('not_ready', __('imports.not_ready'));
        }
        $busy = ProductImport::query()->whereIn('status', [ImportStatus::Queued->value, ImportStatus::Processing->value])->exists();
        if ($busy) {
            throw ApiException::conflict('busy', __('imports.busy'));
        }

        $import->forceFill([
            'mapping' => $mapping,
            'options' => [...($import->options ?? []), ...$options, 'visible' => (bool) ($options['visible'] ?? true)],
            'status' => ImportStatus::Queued,
        ])->save();
        ProcessProductImport::dispatch((int) Tenancy::id(), $import->id)->afterCommit();

        return $import->refresh();
    }
}
