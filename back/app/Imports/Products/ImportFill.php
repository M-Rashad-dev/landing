<?php

declare(strict_types=1);

namespace App\Imports\Products;

/**
 * Values for EMPTY cells of a sheet (e.g. «any product with no price gets 1500»): the import option `fill`. A field
 * with no column gets an extra virtual column, so the sheet needs no edit. Only the product's main row is filled
 * (variant rows without a price keep taking the product's price). Used by the importer and by ImportCheck alike.
 */
final class ImportFill
{
    /** Fields a fill may set. */
    public const FIELDS = ['price', 'stock'];

    /**
     * The mapping with a virtual column for each filled field the sheet lacks.
     *
     * @param  array<string, int|list<int>>  $mapping
     * @param  array<string, mixed>  $fill
     * @return array<string, int|list<int>>
     */
    public static function mapping(array $mapping, array $fill, int $width): array
    {
        foreach (self::values($fill) as $field => $value) {
            if (! isset($mapping[$field])) {
                $mapping[$field] = $width++;
            }
        }

        return $mapping;
    }

    /**
     * One product's rows with its empty filled cells set.
     *
     * @param  list<array{line: int, cells: list<string>}>  $rows
     * @param  array<string, int|list<int>>  $mapping  from mapping()
     * @param  array<string, mixed>  $fill
     * @return list<array{line: int, cells: list<string>}>
     */
    public static function rows(array $rows, array $mapping, array $fill): array
    {
        $values = self::values($fill);
        if ($values === [] || $rows === []) {
            return $rows;
        }
        $base = 0;
        $name = $mapping['name'] ?? null;
        if (is_int($name)) {
            foreach ($rows as $i => $row) {
                if (trim($row['cells'][$name] ?? '') !== '') {
                    $base = $i;
                    break;
                }
            }
        }
        foreach ($values as $field => $value) {
            $column = $mapping[$field] ?? null;
            if (! is_int($column) || trim($rows[$base]['cells'][$column] ?? '') !== '') {
                continue;
            }
            $cells = $rows[$base]['cells'];
            for ($c = count($cells); $c < $column; $c++) {
                $cells[$c] = '';
            }
            $cells[$column] = $value;
            $rows[$base]['cells'] = array_values($cells);
        }

        return $rows;
    }

    /**
     * The usable fill values as sheet text.
     *
     * @param  array<string, mixed>  $fill
     * @return array<string, string>
     */
    public static function values(array $fill): array
    {
        $out = [];
        foreach (self::FIELDS as $field) {
            $value = $fill[$field] ?? null;
            if (is_numeric($value)) {
                $out[$field] = (string) $value;
            }
        }

        return $out;
    }
}
