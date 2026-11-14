<?php

declare(strict_types=1);

namespace App\Imports\Products;

use App\Actions\Products\SaveProduct;
use App\Billing\Entitlements;
use App\Enums\ImportStatus;
use App\Enums\PlanFeature;
use App\Exceptions\ApiException;
use App\Imports\Spreadsheet\SpreadsheetReader;
use App\Jobs\ImportProductImages;
use App\Jobs\RevalidateTenantHosts;
use App\Models\Category;
use App\Models\Product;
use App\Models\ProductImport;
use App\Models\ProductImportFailure;
use App\Store\Categories;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;
use Throwable;

/**
 * Runs an import inside its tenant: reads the sheet, groups the rows into products and saves them
 * one by one (a bad product never stops the others). Counters are written every few products so
 * the screen can follow; a restarted job carries on from the last product it counted.
 */
final class ProductImporter
{
    /** Write the counters at least this often. */
    private const FLUSH_EVERY = 10;

    private const FLUSH_SECONDS = 2.0;

    /** @var array<string, int> "parent id|lowercase name" → category id */
    private array $categoryIds = [];

    /** @var array<string, true> */
    private array $notes = [];

    private ?string $limitReason = null;

    private ?bool $storeAllowed = null;

    public function __construct(
        private readonly SpreadsheetReader $reader,
        private readonly RowGrouper $grouper,
        private readonly DraftBuilder $builder,
        private readonly SaveProduct $save,
        private readonly Categories $categories,
        private readonly Entitlements $entitlements,
    ) {}

    public function run(ProductImport $import): void
    {
        $import->refresh();
        if ($import->status->isFinished()) {
            return;
        }
        $mapping = (array) $import->mapping;
        $sheet = $this->reader->open(Storage::disk('local')->path((string) $import->file_path), $import->extension);
        $groups = $this->grouper->group($sheet['rows'], $mapping);

        $import->forceFill([
            'status' => ImportStatus::Processing,
            'total_products' => count($groups),
            'started_at' => $import->started_at ?? now(),
        ])->save();
        $this->notes = array_fill_keys((array) $import->warnings, true);

        $match = $import->option('match', 'sku') === 'sku' && isset($mapping['sku']);
        $onExisting = (string) $import->option('existing', 'update');
        $visible = (bool) $import->option('visible', true);
        $existingBySku = $match ? Product::query()->whereNotNull('sku')->pluck('id', 'sku')->mapWithKeys(fn ($id, $sku) => [mb_strtolower((string) $sku) => (int) $id])->all() : [];
        $seenSkus = [];
        $counters = ['created_count' => 0, 'updated_count' => 0, 'skipped_count' => 0, 'failed_count' => 0, 'images_total' => 0];
        $done = $import->processed;
        $lastFlush = microtime(true);
        $pending = 0;

        // Products a restarted job already counted are only remembered for duplicate SKUs.
        foreach ($groups as $i => $rows) {
            if ($i < $done) {
                $sku = $this->skuOf($rows, $mapping);
                if ($sku !== null) {
                    $seenSkus[$sku] ??= $rows[0]['line'];
                }

                continue;
            }

            $outcome = $this->one($import, $rows, $mapping, $visible, $match, $onExisting, $existingBySku, $seenSkus);
            $counters[$outcome['counter']]++;
            $counters['images_total'] += $outcome['images'];
            $done++;
            $pending++;

            if ($pending >= self::FLUSH_EVERY || microtime(true) - $lastFlush >= self::FLUSH_SECONDS) {
                if ($this->flush($import, $done, $counters)) {
                    return; // cancelled
                }
                $counters = array_map(fn () => 0, $counters);
                $pending = 0;
                $lastFlush = microtime(true);
            }
        }

        $this->flush($import, $done, $counters);
        $import->refresh();
        if ($import->status === ImportStatus::Cancelled) {
            return;
        }
        $import->forceFill(['status' => ImportStatus::Completed, 'finished_at' => now(), 'warnings' => $this->warnings()])->save();
        $this->deleteFile($import);
        RevalidateTenantHosts::dispatch($import->tenant_id)->afterCommit();
    }

    /** Marks the import failed (job gave up) and keeps what was already counted. */
    public function fail(ProductImport $import, string $error): void
    {
        $import->forceFill(['status' => ImportStatus::Failed, 'error' => mb_substr($error, 0, 300), 'finished_at' => now()])->save();
        $this->deleteFile($import);
    }

    public function deleteFile(ProductImport $import): void
    {
        if ($import->file_path !== null) {
            Storage::disk('local')->delete($import->file_path);
            $import->forceFill(['file_path' => null])->save();
        }
    }

    /**
     * @param  list<array{line: int, cells: list<string>}>  $rows
     * @param  array<string, int|list<int>>  $mapping
     * @param  array<string, int>  $existingBySku
     * @param  array<string, int>  $seenSkus
     * @return array{counter: string, images: int}
     */
    private function one(ProductImport $import, array $rows, array $mapping, bool $visible, bool $match, string $onExisting, array &$existingBySku, array &$seenSkus): array
    {
        $sku = $this->skuOf($rows, $mapping);
        $existing = null;
        if ($match && $sku !== null && isset($existingBySku[$sku]) && ! isset($seenSkus[$sku])) {
            if ($onExisting === 'skip') {
                $seenSkus[$sku] = $rows[0]['line'];

                return ['counter' => 'skipped_count', 'images' => 0];
            }
            $existing = Product::query()->find($existingBySku[$sku]);
        }

        $draft = $this->builder->build($rows, $mapping, $visible, $existing);
        foreach ($draft->notes as $note) {
            $this->notes[$note] = true;
        }
        $errors = $draft->errors;
        if ($sku !== null && isset($seenSkus[$sku])) {
            $errors[] = __('imports.duplicate_sku', ['sku' => $draft->sku ?? $sku, 'row' => $seenSkus[$sku]]);
        }
        if ($errors === [] && $existing === null && $this->limitReason !== null) {
            $errors[] = $this->limitReason;
        }
        if ($errors !== []) {
            $this->failure($import, $rows, $draft, $errors);

            return ['counter' => 'failed_count', 'images' => 0];
        }
        if ($sku !== null) {
            $seenSkus[$sku] = $rows[0]['line'];
        }

        try {
            $payload = $draft->payload;
            if (isset($payload['slug']) && Product::query()->withTrashed()->where('slug', $payload['slug'])->when($existing, fn ($q) => $q->whereKeyNot($existing->id))->exists()) {
                unset($payload['slug']);
            }
            $categoryIds = $this->categoryIds($draft->categories);
            if ($categoryIds !== []) {
                $payload['category_ids'] = $categoryIds;
                $payload['primary_category_id'] = $categoryIds[0];
            }
            $product = $this->save->handle($payload, $existing, revalidate: false);
        } catch (ApiException $e) {
            if ($e->errorCode === 'plan_limit_reached' && $existing === null) {
                $this->limitReason = $e->getMessage();
            }
            $this->failure($import, $rows, $draft, [$e->getMessage()]);

            return ['counter' => 'failed_count', 'images' => 0];
        } catch (ValidationException $e) {
            $this->failure($import, $rows, $draft, array_values(array_unique(array_merge(...array_values($e->errors())))));

            return ['counter' => 'failed_count', 'images' => 0];
        } catch (Throwable $e) {
            Log::warning('product import row failed', ['import' => $import->id, 'line' => $draft->line, 'error' => $e->getMessage()]);
            $this->failure($import, $rows, $draft, [__('imports.save_failed')]);

            return ['counter' => 'failed_count', 'images' => 0];
        }

        if ($sku !== null) {
            $existingBySku[$sku] = $product->id;
        }
        if ($draft->images !== []) {
            ImportProductImages::dispatch($import->tenant_id, $import->id, $product->id, $draft->images, $existing !== null);
        }

        return ['counter' => $existing !== null ? 'updated_count' : 'created_count', 'images' => count($draft->images)];
    }

    /**
     * @param  list<array{line: int, cells: list<string>}>  $rows
     * @param  list<string>  $reasons
     */
    private function failure(ProductImport $import, array $rows, ProductDraft $draft, array $reasons): void
    {
        ProductImportFailure::query()->create([
            'product_import_id' => $import->id,
            'row_number' => $draft->line,
            'identifier' => $draft->identifier,
            'name' => $draft->name !== '' ? mb_substr($draft->name, 0, 200) : null,
            'reasons' => array_values(array_unique($reasons)),
            'cells' => array_map(fn (array $row) => $row['cells'], array_slice($rows, 0, 50)),
        ]);
    }

    /**
     * @param  list<array{line: int, cells: list<string>}>  $rows
     * @param  array<string, int|list<int>>  $mapping
     */
    private function skuOf(array $rows, array $mapping): ?string
    {
        if (! isset($mapping['sku']) || ! is_int($mapping['sku'])) {
            return null;
        }
        foreach ($rows as $row) {
            $sku = mb_strtolower(CellParser::line($row['cells'][$mapping['sku']] ?? ''));
            if ($sku !== '') {
                return mb_substr($sku, 0, 60);
            }
        }

        return null;
    }

    /**
     * Finds or creates each path ("ملابس > رجالي"); a category that cannot be made is noted, never fatal.
     *
     * @param  list<list<string>>  $paths
     * @return list<int>
     */
    private function categoryIds(array $paths): array
    {
        if ($paths === []) {
            return [];
        }
        $this->storeAllowed ??= $this->entitlements->allows(PlanFeature::Store);
        if (! $this->storeAllowed) {
            $this->notes['categories_skipped'] = true;

            return [];
        }

        $ids = [];
        foreach ($paths as $path) {
            $parent = null;
            foreach ($path as $name) {
                $key = ($parent ?? 0).'|'.mb_strtolower($name);
                if (! isset($this->categoryIds[$key])) {
                    // Names compare case-insensitively (the column collation).
                    $found = Category::query()->where('parent_id', $parent)->where('name', $name)->value('id');
                    if ($found === null) {
                        try {
                            $found = $this->categories->create(['name' => $name, 'parent_id' => $parent])->id;
                        } catch (ApiException|ValidationException $e) {
                            $this->notes['category_failed|'.$name.'|'.$e->getMessage()] = true;

                            break;
                        }
                    }
                    $this->categoryIds[$key] = (int) $found;
                }
                $parent = $this->categoryIds[$key];
            }
            if ($parent !== null) {
                $ids[] = $parent;
            }
        }

        return array_values(array_unique($ids));
    }

    /**
     * Writes the counters (added to what is stored, so restarts never double count). True when
     * the merchant cancelled meanwhile.
     *
     * @param  array<string, int>  $counters
     */
    private function flush(ProductImport $import, int $done, array $counters): bool
    {
        $updates = ['processed' => $done, 'warnings' => json_encode($this->warnings(), JSON_UNESCAPED_UNICODE), 'updated_at' => now()];
        foreach ($counters as $column => $n) {
            if ($n > 0) {
                $updates[$column] = DB::raw("{$column} + {$n}");
            }
        }
        ProductImport::query()->whereKey($import->id)->update($updates);

        return ProductImport::query()->whereKey($import->id)->value('status') === ImportStatus::Cancelled->value;
    }

    /** @return list<string> notes for the merchant, translated once */
    private function warnings(): array
    {
        $out = [];
        foreach (array_keys($this->notes) as $note) {
            if (str_starts_with($note, 'category_failed|')) {
                [, $name, $reason] = explode('|', $note, 3) + [1 => '', 2 => ''];
                $out[] = __('imports.category_failed', ['name' => $name, 'reason' => $reason]);
            } elseif (! str_contains($note, ' ')) {
                $out[] = __('imports.'.$note);
            } else {
                $out[] = $note;
            }
        }

        return array_slice(array_values(array_unique($out)), 0, 20);
    }
}
