<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Enums\ImportStatus;
use App\Models\ProductImport;
use App\Tenancy\Tenancy;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Storage;

/**
 * Daily: a sheet uploaded but never imported for a day is dropped (file and row); the history of
 * finished imports is kept 90 days (the products they saved are never touched).
 */
final class PruneProductImports extends Command
{
    protected $signature = 'imports:prune';

    protected $description = 'Drop product sheets never imported and old import history';

    public function handle(): int
    {
        // Audited bypass: one cleanup across all tenants, only rows past their retention window.
        $count = Tenancy::withoutTenant(function (): int {
            $old = ProductImport::query()
                ->where(fn ($q) => $q->where('status', ImportStatus::Uploaded->value)->where('created_at', '<', now()->subDay()))
                ->orWhere(fn ($q) => $q->whereIn('status', [ImportStatus::Completed->value, ImportStatus::Failed->value, ImportStatus::Cancelled->value])->where('created_at', '<', now()->subDays(90)))
                ->get(['id', 'file_path']);
            foreach ($old as $import) {
                if ($import->file_path !== null) {
                    Storage::disk('local')->delete($import->file_path);
                }
            }

            return ProductImport::query()->whereIn('id', $old->pluck('id'))->delete();
        });

        $this->info(sprintf('Pruned %d imports.', $count));

        return self::SUCCESS;
    }
}
