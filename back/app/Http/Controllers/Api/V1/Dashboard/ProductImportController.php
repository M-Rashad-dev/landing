<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Dashboard;

use App\Enums\ImportStatus;
use App\Exceptions\ApiException;
use App\Http\Controllers\Concerns\RespondsWithJson;
use App\Http\Controllers\Controller;
use App\Http\Requests\Dashboard\ProductImportStartRequest;
use App\Http\Requests\Dashboard\ProductImportUploadRequest;
use App\Http\Resources\ProductImportFailureResource;
use App\Imports\Products\ColumnMapper;
use App\Imports\Products\ImportFiles;
use App\Imports\Products\ProductImporter;
use App\Jobs\ProcessProductImport;
use App\Models\ProductImport;
use App\Models\ProductImportFailure;
use App\Tenancy\Tenancy;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

/**
 * Product import from a sheet: upload (we show the columns and our guess), confirm the mapping
 * (the queue does the work), follow the counters, see / download what failed and why.
 */
final class ProductImportController extends Controller
{
    use RespondsWithJson;

    public function __construct(private readonly ImportFiles $files) {}

    /** The last imports (history). */
    public function index(): JsonResponse
    {
        $imports = ProductImport::query()->latest('id')->limit(20)->get();

        return $this->ok($imports->map(fn (ProductImport $i) => $this->row($i, false))->all());
    }

    public function store(ProductImportUploadRequest $request): JsonResponse
    {
        $import = $this->files->upload($request->file('file'), $request->user()?->getAuthIdentifier());

        return $this->created($this->row($import, true));
    }

    public function show(ProductImport $productImport): JsonResponse
    {
        return $this->ok($this->row($productImport, $productImport->status === ImportStatus::Uploaded));
    }

    public function start(ProductImportStartRequest $request, ProductImport $productImport): JsonResponse
    {
        if ($productImport->status !== ImportStatus::Uploaded || $productImport->file_path === null) {
            throw ApiException::conflict('not_ready', __('imports.not_ready'));
        }
        $busy = ProductImport::query()->whereIn('status', [ImportStatus::Queued->value, ImportStatus::Processing->value])->exists();
        if ($busy) {
            throw ApiException::conflict('busy', __('imports.busy'));
        }

        $productImport->forceFill([
            'mapping' => $request->mapping(),
            'options' => [...($productImport->options ?? []), ...$request->validated('options'), 'visible' => (bool) $request->validated('options.visible')],
            'status' => ImportStatus::Queued,
        ])->save();
        ProcessProductImport::dispatch((int) Tenancy::id(), $productImport->id)->afterCommit();

        return $this->ok($this->row($productImport->refresh(), false));
    }

    /** Stops after the product being saved now; what was saved stays. */
    public function cancel(ProductImport $productImport, ProductImporter $importer): JsonResponse
    {
        if ($productImport->status->isFinished()) {
            return $this->ok($this->row($productImport, false));
        }
        $productImport->forceFill(['status' => ImportStatus::Cancelled, 'finished_at' => now()])->save();
        $importer->deleteFile($productImport);

        return $this->ok($this->row($productImport->refresh(), false));
    }

    /** Removes an import from the history (not one that is running); the products it saved stay. */
    public function destroy(ProductImport $productImport, ProductImporter $importer): Response
    {
        if ($productImport->status->isActive()) {
            throw ApiException::conflict('busy', __('imports.busy'));
        }
        $importer->deleteFile($productImport);
        $productImport->delete();

        return $this->noContent();
    }

    public function failures(Request $request, ProductImport $productImport): JsonResponse
    {
        $page = ProductImportFailure::query()->where('product_import_id', $productImport->id)->orderBy('row_number')->orderBy('id')
            ->paginate(min(100, max(10, (int) $request->query('per_page', 50))));

        return $this->paginated($page, ProductImportFailureResource::class);
    }

    public function failuresFile(ProductImport $productImport): BinaryFileResponse
    {
        return response()->download($this->files->failures($productImport), __('imports.failures_name').'-'.$productImport->id.'.xlsx')->deleteFileAfterSend();
    }

    public function template(): BinaryFileResponse
    {
        return response()->download($this->files->template(), __('imports.template_name').'.xlsx')->deleteFileAfterSend();
    }

    /** @return array<string, mixed> */
    private function row(ProductImport $import, bool $withPreview): array
    {
        $row = [
            'id' => $import->id,
            'status' => $import->status->value,
            'source' => $import->source,
            'file_name' => $import->file_name,
            'total_rows' => $import->total_rows,
            'total_products' => $import->total_products,
            'processed' => $import->processed,
            'created' => $import->created_count,
            'updated' => $import->updated_count,
            'skipped' => $import->skipped_count,
            'failed' => $import->failed_count,
            'images' => ['total' => $import->images_total, 'done' => $import->images_done, 'failed' => $import->images_failed],
            'warnings' => $import->warnings ?? [],
            'error' => $import->error === null ? null : __('imports.save_failed'),
            'options' => array_diff_key($import->options ?? [], ['samples' => true]),
            'created_at' => $import->created_at?->toIso8601ZuluString(),
            'started_at' => $import->started_at?->toIso8601ZuluString(),
            'finished_at' => $import->finished_at?->toIso8601ZuluString(),
        ];
        if ($withPreview) {
            $row['headers'] = $import->headers;
            $row['samples'] = $import->option('samples', []);
            $row['mapping'] = (object) ($import->mapping ?? []);
            $row['fields'] = ColumnMapper::FIELDS;
            $row['multi'] = ColumnMapper::MULTI;
            $row['room'] = $this->files->room();
        }

        return $row;
    }
}
