<?php

declare(strict_types=1);

namespace App\Store\Specs;

use App\Models\Product;
use App\Models\ProductSpecRow;
use App\Tenancy\Tenancy;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Spec filters on category / search pages (docs/plans/tekno/PLAN.md §2.1): only rows flagged «فلتر في صفحة القسم»
 * count. Values match as typed (trimmed; the column's collation ignores case); several values of one label = any of
 * them, several labels = all of them. Facets = the values of each filterable label in a list with their product
 * counts, cached per store and list for 10 minutes and dropped whenever the store's pages are refreshed.
 */
final class SpecFilters
{
    public const MAX_LABELS = 30;

    public const MAX_VALUES = 50;

    /** What one request may filter by (more is ignored). */
    public const MAX_SELECTED_LABELS = 10;

    public const MAX_SELECTED_VALUES = 20;

    public const TTL = 600;

    /**
     * The visitor's choice from the request (`{"label": ["value", …]}` as JSON), cleaned and bounded. Anything
     * unreadable is ignored (a broken link shows the whole list, never an error page).
     *
     * @return array<string, list<string>>
     */
    public static function parse(mixed $json): array
    {
        $data = is_string($json) && $json !== '' ? json_decode($json, true) : null;
        if (! is_array($data)) {
            return [];
        }
        $out = [];
        foreach ($data as $label => $values) {
            $label = mb_substr(trim((string) $label), 0, 60);
            if ($label === '' || ! is_array($values)) {
                continue;
            }
            $clean = array_values(array_unique(array_filter(array_map(fn ($v) => is_scalar($v) ? mb_substr(trim((string) $v), 0, 200) : '', $values), fn (string $v) => $v !== '')));
            if ($clean !== []) {
                $out[$label] = array_slice($clean, 0, self::MAX_SELECTED_VALUES);
            }
            if (count($out) >= self::MAX_SELECTED_LABELS) {
                break;
            }
        }

        return $out;
    }

    /**
     * Keeps the products with, for every chosen label, a filterable row holding one of its values.
     *
     * @param  Builder<Product>  $query
     * @param  array<string, list<string>>  $spec
     */
    public function apply(Builder $query, array $spec): void
    {
        foreach ($spec as $label => $values) {
            $query->whereHas('specTables.rows', fn (Builder $rows) => $rows->where('filterable', true)->where('label', $label)->whereIn('value', $values));
        }
    }

    /**
     * The filterable labels of the list's products with their values and how many products have each.
     *
     * @param  Builder<Product>  $base  the list before price / spec filters
     * @param  array<string, mixed>  $key  what makes the list (category, search…), for the cache
     * @return list<array{label: string, values: list<array{value: string, count: int}>}>
     */
    public function facets(Builder $base, array $key): array
    {
        $cacheKey = 'spec-facets:'.Tenancy::id().':'.$this->version().':'.md5((string) json_encode($key));

        return Cache::remember($cacheKey, self::TTL, function () use ($base): array {
            $rows = ProductSpecRow::query()
                ->join('product_spec_tables', 'product_spec_tables.id', '=', 'product_spec_rows.product_spec_table_id')
                ->where('product_spec_rows.filterable', true)
                ->whereNotNull('product_spec_rows.value')
                ->where('product_spec_rows.value', '!=', '')
                ->whereIn('product_spec_tables.product_id', $base->clone()->reorder()->select('products.id'))
                ->groupBy('product_spec_rows.label', 'product_spec_rows.value')
                ->select('product_spec_rows.label', 'product_spec_rows.value', DB::raw('count(distinct product_spec_tables.product_id) as products'))
                ->get();

            $labels = [];
            foreach ($rows as $row) {
                $key = ProductSpecs::key((string) $row->getAttribute('label'));
                $labels[$key] ??= ['label' => (string) $row->getAttribute('label'), 'total' => 0, 'values' => []];
                $count = (int) $row->getAttribute('products');
                $labels[$key]['total'] += $count;
                $labels[$key]['values'][] = ['value' => (string) $row->getAttribute('value'), 'count' => $count];
            }
            uasort($labels, fn (array $a, array $b) => [$b['total'], $a['label']] <=> [$a['total'], $b['label']]);

            return array_values(array_map(function (array $facet): array {
                usort($facet['values'], fn (array $a, array $b) => strnatcasecmp($a['value'], $b['value']));

                return ['label' => $facet['label'], 'values' => array_slice($facet['values'], 0, self::MAX_VALUES)];
            }, array_slice($labels, 0, self::MAX_LABELS)));
        });
    }

    /** Drops the store's cached facets (its products or specs changed). */
    public function forget(int $tenantId): void
    {
        Cache::forget(self::versionKey($tenantId));
    }

    private function version(): string
    {
        return (string) Cache::rememberForever(self::versionKey((int) Tenancy::id()), fn () => Str::random(8));
    }

    private static function versionKey(int $tenantId): string
    {
        return "spec-facets-version:{$tenantId}";
    }
}
