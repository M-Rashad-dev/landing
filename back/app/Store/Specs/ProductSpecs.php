<?php

declare(strict_types=1);

namespace App\Store\Specs;

use App\Models\Product;
use App\Models\ProductSpecRow;
use App\Models\ProductSpecTable;
use App\Models\SpecGroupRow;
use App\Tenancy\Tenancy;
use Illuminate\Support\Collection;

/**
 * A product's «المواصفات» (docs/plans/tekno/PLAN.md §1): its spec tables as the product form sends them (the whole
 * list replaces the old one), the shapes the dashboard / storefront / cards read, and the copy of a group into a
 * product. Values are plain text, kept as typed (trimmed).
 *
 * @phpstan-type SpecRow array{label: string, value: string|null, in_card: bool, filterable: bool}
 * @phpstan-type SpecTable array{spec_group_id: int|null, name: string, rows: list<SpecRow>}
 */
final class ProductSpecs
{
    public static function maxTables(): int
    {
        return (int) config('landing.limits.spec_tables');
    }

    public static function maxRows(): int
    {
        return (int) config('landing.limits.spec_rows');
    }

    public static function maxCardRows(): int
    {
        return (int) config('landing.limits.spec_card_rows');
    }

    /** Labels and table names compare without case and outer spaces («الرامات» = « الرامات »). */
    public static function key(string $text): string
    {
        return mb_strtolower(trim($text));
    }

    /**
     * Replaces the product's tables with the given ones (validated by ProductRequest). Nothing is written when
     * they are the same as now.
     *
     * @param  list<array<string, mixed>>  $tables
     */
    public function sync(Product $product, array $tables): void
    {
        $next = array_map(fn (array $t) => self::clean($t), array_values($tables));
        if ($next === $this->current($product)) {
            return;
        }
        ProductSpecTable::query()->where('product_id', $product->id)->delete();
        $this->insert($product, $next);
        $product->unsetRelation('specTables')->unsetRelation('cardSpecs');
    }

    /**
     * Adds tables after the product's own (copies of a group, import tables).
     *
     * @param  list<SpecTable>  $tables
     */
    public function insert(Product $product, array $tables, int $startAt = 0): void
    {
        $rows = [];
        foreach ($tables as $i => $table) {
            $model = ProductSpecTable::query()->create([
                'product_id' => $product->id,
                'spec_group_id' => $table['spec_group_id'],
                'name' => $table['name'],
                'position' => $startAt + $i,
            ]);
            foreach ($table['rows'] as $position => $row) {
                $rows[] = self::rowValues($model, $row, $position);
            }
        }
        foreach (array_chunk($rows, 500) as $chunk) {
            // tenant_id set in rowValues (insert() skips model events).
            ProductSpecRow::query()->insert($chunk);
        }
    }

    /**
     * The tables of a product in the shape sync() takes (for comparisons and edits).
     *
     * @return list<SpecTable>
     */
    public function current(Product $product): array
    {
        $product->loadMissing('specTables.rows');

        return $product->specTables->map(fn (ProductSpecTable $t) => [
            'spec_group_id' => $t->spec_group_id,
            'name' => $t->name,
            'rows' => $t->rows->map(fn (ProductSpecRow $r) => ['label' => $r->label, 'value' => $r->value, 'in_card' => $r->in_card, 'filterable' => $r->filterable])->values()->all(),
        ])->values()->all();
    }

    /**
     * The dashboard's shape (product form).
     *
     * @return list<array<string, mixed>>
     */
    public function forDashboard(Product $product): array
    {
        $product->loadMissing('specTables.rows');

        return $product->specTables->map(fn (ProductSpecTable $t) => [
            'id' => $t->id,
            'spec_group_id' => $t->spec_group_id,
            'name' => $t->name,
            'rows' => $t->rows->map(fn (ProductSpecRow $r) => ['label' => $r->label, 'value' => $r->value, 'in_card' => $r->in_card, 'filterable' => $r->filterable])->values()->all(),
        ])->values()->all();
    }

    /**
     * What visitors see: rows with a value only, tables left empty dropped, in order.
     *
     * @return list<array{name: string, rows: list<array{label: string, value: string, in_card: bool}>}>
     */
    public function forPublic(Product $product): array
    {
        $product->loadMissing('specTables.rows');
        $out = [];
        foreach ($product->specTables as $table) {
            $rows = $table->rows
                ->filter(fn (ProductSpecRow $r) => trim((string) $r->value) !== '')
                ->map(fn (ProductSpecRow $r) => ['label' => $r->label, 'value' => (string) $r->value, 'in_card' => $r->in_card])
                ->values()->all();
            if ($rows !== []) {
                $out[] = ['name' => $table->name, 'rows' => $rows];
            }
        }

        return $out;
    }

    /**
     * The values a product card shows (rows flagged «يظهر في كارت المنتج»), at most 4, in row order.
     *
     * @return list<string>
     */
    public function chips(Product $product): array
    {
        $rows = $product->relationLoaded('cardSpecs') ? $product->cardSpecs : $product->cardSpecs()->limit(self::maxCardRows())->get();

        return $rows->take(self::maxCardRows())->map(fn (ProductSpecRow $r) => (string) $r->value)->values()->all();
    }

    /** Copies the tables of one product into another (duplicate product). */
    public function copy(Product $from, Product $to): void
    {
        $this->insert($to, $this->current($from));
    }

    /**
     * A group's rows as a product table's rows (values empty), flags kept while the product has room for card rows.
     *
     * @param  Collection<int, SpecGroupRow>  $groupRows
     * @return list<SpecRow>
     */
    public static function rowsFromGroup(Collection $groupRows, int &$cardRoom): array
    {
        $rows = [];
        foreach ($groupRows as $row) {
            $inCard = $row->in_card && $cardRoom > 0;
            if ($inCard) {
                $cardRoom--;
            }
            $rows[] = ['label' => $row->label, 'value' => null, 'in_card' => $inCard, 'filterable' => $row->filterable];
        }

        return $rows;
    }

    /**
     * @param  array<string, mixed>  $row
     * @return array<string, mixed>
     */
    public static function rowValues(ProductSpecTable $table, array $row, int $position): array
    {
        return [
            'tenant_id' => $table->tenant_id ?: Tenancy::id(),
            'product_spec_table_id' => $table->id,
            'label' => $row['label'],
            'value' => $row['value'] ?? null,
            'position' => $position,
            'in_card' => (bool) ($row['in_card'] ?? false),
            'filterable' => (bool) ($row['filterable'] ?? false),
        ];
    }

    /**
     * @param  array<string, mixed>  $table
     * @return SpecTable
     */
    private static function clean(array $table): array
    {
        return [
            'spec_group_id' => isset($table['spec_group_id']) ? (int) $table['spec_group_id'] : null,
            'name' => (string) $table['name'],
            'rows' => array_values(array_map(fn (array $r) => [
                'label' => (string) $r['label'],
                'value' => isset($r['value']) && trim((string) $r['value']) !== '' ? (string) $r['value'] : null,
                'in_card' => (bool) ($r['in_card'] ?? false),
                'filterable' => (bool) ($r['filterable'] ?? false),
            ], (array) ($table['rows'] ?? []))),
        ];
    }
}
