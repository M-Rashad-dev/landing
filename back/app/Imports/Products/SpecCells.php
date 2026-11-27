<?php

declare(strict_types=1);

namespace App\Imports\Products;

use App\Models\Product;
use App\Models\SpecGroup;
use App\Models\SpecGroupRow;
use App\Store\Specs\ProductSpecs;
use Illuminate\Support\Collection;

/**
 * «المواصفات» columns of an import (docs/plans/tekno/PLAN.md §1.5): a column named «{group}: {label}» fills that row
 * of that table. A missing table is made from the store's group of that name (all its rows), or as the product's own
 * table when no group has the name. Empty cells keep the old value; filled ones never delete anything.
 */
final class SpecCells
{
    /** Header «لابتوب: المعالج» → [«لابتوب», «المعالج»] (a header without «:» is a row of «المواصفات»). */
    private const PATTERN = '/^\s*([^:：]{1,60}?)\s*[:：]\s*(.{1,60}?)\s*$/u';

    /** @return array{0: string, 1: string}|null */
    public static function parse(string $header): ?array
    {
        if (preg_match(self::PATTERN, $header, $m) === 1 && trim($m[1]) !== '' && trim($m[2]) !== '') {
            return [trim($m[1]), trim($m[2])];
        }

        return null;
    }

    /** The header of a spec cell, the way the export writes it. */
    public static function header(string $table, string $label): string
    {
        return "{$table}: {$label}";
    }

    /**
     * The table and label of each mapped spec column.
     *
     * @param  list<string>  $headers
     * @param  list<int>  $columns
     * @return array<int, array{0: string, 1: string}>
     */
    public static function columns(array $headers, array $columns): array
    {
        $out = [];
        foreach ($columns as $column) {
            $header = trim((string) ($headers[$column] ?? ''));
            if ($header === '') {
                continue;
            }
            $out[$column] = self::parse($header) ?? [(string) __('specs.default_table'), mb_substr($header, 0, 60)];
        }

        return $out;
    }

    /** @return Collection<string, SpecGroup> the store's groups with their rows, by name key */
    public static function groups(): Collection
    {
        return SpecGroup::query()->with('rows')->get()->keyBy(fn (SpecGroup $g) => ProductSpecs::key($g->name));
    }

    /**
     * The product's spec tables with the row's cells written in (SaveProduct's `specs`), or null when the row has no
     * spec value (the product's tables stay as they are).
     *
     * @param  list<string>  $cells
     * @param  array<int, array{0: string, 1: string}>  $columns
     * @param  Collection<string, SpecGroup>  $groups
     * @param  array<string, true>  $notes  import-wide notes (translation keys)
     * @return list<array<string, mixed>>|null
     */
    public function payload(?Product $existing, array $cells, array $columns, Collection $groups, array &$notes): ?array
    {
        $values = [];
        foreach ($columns as $column => [$table, $label]) {
            $value = mb_substr(CellParser::line($cells[$column] ?? ''), 0, 200);
            if ($value !== '') {
                $values[] = [$table, $label, $value];
            }
        }
        if ($values === []) {
            return null;
        }

        $tables = $existing !== null ? app(ProductSpecs::class)->current($existing) : [];
        $room = ProductSpecs::maxCardRows() - array_sum(array_map(fn (array $t) => count(array_filter($t['rows'], fn (array $r) => $r['in_card'])), $tables));

        foreach ($values as [$tableName, $label, $value]) {
            $t = $this->find($tables, 'name', $tableName);
            if ($t === null) {
                if (count($tables) >= ProductSpecs::maxTables()) {
                    $notes['spec_tables_limit'] = true;

                    continue;
                }
                $group = $groups->get(ProductSpecs::key($tableName));
                $tables[] = $group !== null
                    ? ['spec_group_id' => $group->id, 'name' => $group->name, 'rows' => ProductSpecs::rowsFromGroup($group->rows, $room)]
                    : ['spec_group_id' => null, 'name' => mb_substr($tableName, 0, 60), 'rows' => []];
                $t = count($tables) - 1;
            }
            $r = $this->find($tables[$t]['rows'], 'label', $label);
            if ($r !== null) {
                $tables[$t]['rows'][$r]['value'] = $value;

                continue;
            }
            if (count($tables[$t]['rows']) >= ProductSpecs::maxRows()) {
                $notes['spec_rows_limit'] = true;

                continue;
            }
            /** @var SpecGroupRow|null $groupRow */
            $groupRow = $groups->get(ProductSpecs::key($tables[$t]['name']))?->rows->first(fn (SpecGroupRow $row) => ProductSpecs::key($row->label) === ProductSpecs::key($label));
            $inCard = $groupRow !== null && $groupRow->in_card && $room > 0;
            if ($inCard) {
                $room--;
            }
            $tables[$t]['rows'][] = ['label' => mb_substr($label, 0, 60), 'value' => $value, 'in_card' => $inCard, 'filterable' => (bool) $groupRow?->filterable];
        }

        // A table made from a header alone may have no row left (limits): never send an empty table.
        return array_values(array_filter($tables, fn (array $t) => $t['rows'] !== []));
    }

    /** @param list<array<string, mixed>> $items */
    private function find(array $items, string $key, string $text): ?int
    {
        foreach ($items as $i => $item) {
            if (ProductSpecs::key((string) $item[$key]) === ProductSpecs::key($text)) {
                return $i;
            }
        }

        return null;
    }
}
