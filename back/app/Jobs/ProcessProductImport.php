<?php

declare(strict_types=1);

namespace App\Jobs;

use App\Imports\Products\ProductImporter;
use App\Models\ProductImport;
use App\Tenancy\Tenancy;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Log;
use Throwable;

/** Works through a product import in the background (resumes from its last count if restarted). */
final class ProcessProductImport implements ShouldQueue
{
    use Queueable;

    public int $tries = 3;

    /** A big sheet (thousands of products) may take a while; images are separate jobs. */
    public int $timeout = 1800;

    public function __construct(public readonly int $tenantId, public readonly int $importId) {}

    /** @return list<int> */
    public function backoff(): array
    {
        return [10, 60];
    }

    public function handle(ProductImporter $importer): void
    {
        Tenancy::runAs($this->tenantId, function () use ($importer): void {
            $import = ProductImport::query()->find($this->importId);
            if ($import !== null) {
                $importer->run($import);
            }
        });
    }

    public function failed(?Throwable $e): void
    {
        Log::warning('product import failed', ['import' => $this->importId, 'error' => $e?->getMessage()]);
        Tenancy::runAs($this->tenantId, function () use ($e): void {
            $import = ProductImport::query()->find($this->importId);
            if ($import !== null && ! $import->status->isFinished()) {
                app(ProductImporter::class)->fail($import, (string) ($e?->getMessage() ?? 'failed'));
            }
        });
    }
}
