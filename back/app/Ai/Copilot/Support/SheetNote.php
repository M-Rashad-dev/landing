<?php

declare(strict_types=1);

namespace App\Ai\Copilot\Support;

use App\Enums\ImportStatus;
use App\Imports\Products\ImportCheck;
use App\Models\ProductImport;
use App\Models\ProductImportFailure;

/**
 * What the model knows about a sheet attached in the chat: its columns, a few rows and the importer's dry-run check
 * when it comes in; later turns keep a short line with its status and, once imported, the real counts and the reason
 * of each failed row. So the model never guesses («duplicate SKU?») and never asks for a sheet it already has.
 */
final class SheetNote
{
    private const SAMPLE_ROWS = 5;

    private const FAILURES = 10;

    public function __construct(private readonly ImportCheck $check) {}

    /** The sheet attached to the current message. */
    public function attached(ProductImport $import): string
    {
        $headers = array_map('strval', (array) ($import->headers ?? []));
        $mapping = (array) ($import->mapping ?? []);
        $mapped = [];
        foreach ($mapping as $field => $index) {
            $mapped[] = $field.' ← «'.implode(' + ', array_map(fn ($i) => $headers[(int) $i] ?? '?', (array) $index)).'»';
        }
        $rows = array_slice((array) ($import->options['samples'] ?? []), 0, self::SAMPLE_ROWS);
        $sample = array_map(fn ($row) => '  | '.implode(' | ', array_map(fn ($c) => mb_substr((string) $c, 0, 40), (array) $row)).' |', $rows);
        $check = $import->status === ImportStatus::Uploaded ? $this->check->run($import, $mapping, ['match' => 'sku', 'existing' => 'skip']) : null;

        return implode("\n", array_filter([
            "[The merchant attached a sheet: import_id {$import->id} «{$import->file_name}», {$import->total_rows} rows.",
            'Columns: '.implode(' | ', array_slice($headers, 0, 30)),
            'Read as: '.implode(', ', $mapped),
            $sample !== [] ? "First rows:\n".implode("\n", $sample) : null,
            $check !== null ? "Importer dry run (skip existing SKUs, no fill):\n- ".implode("\n- ", ImportCheck::lines($check)) : null,
            'This sheet is the merchant\'s rows, not the store\'s products. Import it with run_action products.import (import_id '.$import->id.'; fill for empty cells; update_existing for same SKUs).]',
        ]));
    }

    /** A sheet attached earlier in the chat: still usable, or what its import did and why rows failed. */
    public function earlier(ProductImport $import): string
    {
        $head = "[Sheet attached earlier: import_id {$import->id} «{$import->file_name}», {$import->total_rows} rows";
        if ($import->status === ImportStatus::Uploaded) {
            return $head.' — not imported yet, still usable with this import_id (no need to attach it again).]';
        }
        if (! $import->status->isFinished()) {
            return $head.' — importing now ('.$import->processed.' of '.$import->total_products.').]';
        }
        $failures = ProductImportFailure::query()->where('product_import_id', $import->id)->orderBy('row_number')->limit(self::FAILURES)->get();
        $why = $failures->map(fn (ProductImportFailure $f) => 'row '.$f->row_number.' «'.($f->name ?? $f->identifier ?? '—').'»: '.implode('، ', (array) $f->reasons))->all();

        return $head.' — import '.$import->status->value.': created '.$import->created_count.', updated '.$import->updated_count
            .', skipped (same SKU already in the store) '.$import->skipped_count.', failed '.$import->failed_count
            .($why !== [] ? '. Failed rows: '.implode(' / ', $why) : '')
            .'. Its file is gone after an import: to import it again the merchant attaches it again.]';
    }
}
