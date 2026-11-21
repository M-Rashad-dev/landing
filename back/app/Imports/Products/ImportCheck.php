<?php

declare(strict_types=1);

namespace App\Imports\Products;

use App\Imports\Spreadsheet\SpreadsheetReader;
use App\Models\Product;
use App\Models\ProductImport;
use Illuminate\Support\Facades\Storage;
use Throwable;

/**
 * A dry run of an uploaded sheet with the importer's own rules (same grouping, SKU matching, fill and draft checks),
 * writing nothing: how many products it would create / update / skip / fail, and why each failing row fails. The
 * copilot shows it before the merchant approves, so nobody guesses why a row didn't come in.
 */
final class ImportCheck
{
    /** Products checked at most (bigger sheets: the first ones, said so in `partial`). */
    public const MAX = 3000;

    /** Failing / skipped rows listed by name. */
    public const LIST = 10;

    public function __construct(
        private readonly SpreadsheetReader $reader,
        private readonly RowGrouper $grouper,
        private readonly DraftBuilder $builder,
    ) {}

    /**
     * @param  array<string, int|list<int>>  $mapping
     * @param  array<string, mixed>  $options  match, existing, fill
     * @return array{products: int, create: int, update: int, skip: int, fail: int, partial: bool, skipped: list<array{row: int, name: string, sku: string}>, problems: list<array{row: int, name: string, sku: string|null, reasons: list<string>}>}|null null when the file can't be read
     */
    public function run(ProductImport $import, array $mapping, array $options): ?array
    {
        if ($import->file_path === null || ! Storage::disk('local')->exists((string) $import->file_path)) {
            return null;
        }
        try {
            $sheet = $this->reader->open(Storage::disk('local')->path((string) $import->file_path), (string) $import->extension);
        } catch (Throwable) {
            return null;
        }
        $groups = $this->grouper->group($sheet['rows'], $mapping);
        $fill = (array) ($options['fill'] ?? []);
        $mapping = ImportFill::mapping($mapping, $fill, count((array) $import->headers));
        $match = ($options['match'] ?? 'sku') === 'sku' && isset($mapping['sku']);
        $update = ($options['existing'] ?? 'skip') === 'update';
        $existingBySku = $match ? Product::query()->whereNotNull('sku')->pluck('id', 'sku')->mapWithKeys(fn ($id, $sku) => [mb_strtolower((string) $sku) => (int) $id])->all() : [];
        $seen = [];
        $out = ['products' => count($groups), 'create' => 0, 'update' => 0, 'skip' => 0, 'fail' => 0, 'partial' => count($groups) > self::MAX, 'skipped' => [], 'problems' => []];

        foreach (array_slice($groups, 0, self::MAX) as $rows) {
            $rows = ImportFill::rows($rows, $mapping, $fill);
            $sku = ProductImporter::skuOf($rows, $mapping);
            $existing = null;
            if ($match && $sku !== null && isset($existingBySku[$sku]) && ! isset($seen[$sku])) {
                if (! $update) {
                    $seen[$sku] = $rows[0]['line'];
                    $out['skip']++;
                    if (count($out['skipped']) < self::LIST) {
                        $out['skipped'][] = ['row' => (int) $rows[0]['line'], 'name' => self::name($rows, $mapping), 'sku' => $sku];
                    }

                    continue;
                }
                $existing = Product::query()->find($existingBySku[$sku]);
            }
            $draft = $this->builder->build($rows, $mapping, false, $existing);
            $errors = array_map('strval', $draft->errors);
            if ($sku !== null && isset($seen[$sku])) {
                $errors[] = (string) __('imports.duplicate_sku', ['sku' => $draft->sku ?? $sku, 'row' => $seen[$sku]]);
            }
            if ($errors !== []) {
                $out['fail']++;
                if (count($out['problems']) < self::LIST) {
                    $out['problems'][] = ['row' => (int) $draft->line, 'name' => $draft->name !== '' ? mb_substr($draft->name, 0, 80) : self::name($rows, $mapping), 'sku' => $sku, 'reasons' => array_values(array_unique($errors))];
                }

                continue;
            }
            if ($sku !== null) {
                $seen[$sku] = $rows[0]['line'];
            }
            $out[$existing !== null ? 'update' : 'create']++;
        }

        return $out;
    }

    /**
     * The check in short Arabic lines (cards and the model read the same text).
     *
     * @param  array<string, mixed>  $check
     * @return list<string>
     */
    public static function lines(array $check): array
    {
        $lines = [(string) __('ai.copilot.import_check.counts', ['create' => $check['create'], 'update' => $check['update'], 'skip' => $check['skip'], 'fail' => $check['fail']])];
        foreach ((array) $check['problems'] as $p) {
            $lines[] = (string) __('ai.copilot.import_check.problem', ['row' => $p['row'], 'name' => $p['name'], 'sku' => $p['sku'] ?? '—', 'reasons' => implode('، ', $p['reasons'])]);
        }
        if ((array) $check['skipped'] !== []) {
            $lines[] = (string) __('ai.copilot.import_check.skipped', ['list' => implode('، ', array_map(fn (array $s) => "«{$s['name']}» ({$s['sku']})", (array) $check['skipped']))]);
        }
        if ($check['partial']) {
            $lines[] = (string) __('ai.copilot.import_check.partial', ['max' => self::MAX]);
        }

        return $lines;
    }

    /**
     * @param  list<array{line: int, cells: list<string>}>  $rows
     * @param  array<string, int|list<int>>  $mapping
     */
    private static function name(array $rows, array $mapping): string
    {
        $column = $mapping['name'] ?? null;
        foreach ($rows as $row) {
            $name = is_int($column) ? CellParser::line($row['cells'][$column] ?? '') : '';
            if ($name !== '') {
                return mb_substr($name, 0, 80);
            }
        }

        return '—';
    }
}
