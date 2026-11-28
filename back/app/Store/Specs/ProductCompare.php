<?php

declare(strict_types=1);

namespace App\Store\Specs;

use App\Models\Product;
use App\Models\ProductSpecRow;
use App\Store\StoreCatalog;

/**
 * «قارن» (docs/plans/tekno/PLAN.md §2.2): the visitor's products (up to 4, from their browser) side by side: their
 * cards, then their spec rows merged by label — the first product's rows in its order, then labels only later
 * products have. A product without a row shows nothing in that cell. Hidden or gone products are left out.
 */
final class ProductCompare
{
    public const MAX = 4;

    public function __construct(private readonly StoreCatalog $catalog) {}

    /**
     * @param  list<int>  $ids
     * @return array{products: list<array<string, mixed>>, rows: list<array{label: string, group: string, values: object}>}
     */
    public function compare(array $ids): array
    {
        $ids = array_slice(array_values(array_unique($ids)), 0, self::MAX);
        $cards = $this->catalog->cards($ids);
        $shown = array_map(fn (array $c) => (int) $c['id'], $cards);
        $products = $this->catalog->sellable()->with('specTables.rows')->whereKey($shown)->get()->keyBy('id');

        $rows = [];
        foreach ($shown as $id) {
            /** @var Product|null $product */
            $product = $products->get($id);
            foreach ($product?->specTables ?? [] as $table) {
                foreach ($table->rows as $row) {
                    /** @var ProductSpecRow $row */
                    if (trim((string) $row->value) === '') {
                        continue;
                    }
                    $key = ProductSpecs::key($row->label);
                    $rows[$key] ??= ['label' => $row->label, 'group' => $table->name, 'values' => array_fill_keys(array_map('strval', $shown), null)];
                    // A label twice in one product (two tables): the first one counts.
                    $rows[$key]['values'][(string) $id] ??= (string) $row->value;
                }
            }
        }

        // Values by product id: always a JSON object (never a list).
        return ['products' => $cards, 'rows' => array_values(array_map(fn (array $r) => [...$r, 'values' => (object) $r['values']], $rows))];
    }
}
