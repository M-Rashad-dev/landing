<?php

declare(strict_types=1);

namespace App\Imports\Products;

use App\Models\Product;

/**
 * Builds a ProductDraft from the rows of one product. The first named row holds the product;
 * rows with option values are its variants (stock per variant, price differences moved onto the
 * option values). Too-long texts are cut, not refused; only what we cannot guess fails the row.
 */
final class DraftBuilder
{
    private const MAX_IMAGES = 10;

    private const MAX_VALUES = 30;

    private const MAX_PRICE = 9999999.99;

    /**
     * @param  list<array{line: int, cells: list<string>}>  $rows
     * @param  array<string, int|list<int>>  $mapping
     * @param  bool  $visibleByDefault  when the file has no status column / value
     * @param  Product|null  $existing  the product this row updates (missing columns keep its values)
     */
    public function build(array $rows, array $mapping, bool $visibleByDefault, ?Product $existing = null): ProductDraft
    {
        $get = fn (array $cells, string $field): string => isset($mapping[$field]) && is_int($mapping[$field]) ? trim($cells[$mapping[$field]] ?? '') : '';
        $base = $rows[0];
        foreach ($rows as $row) {
            if ($get($row['cells'], 'name') !== '') {
                $base = $row;
                break;
            }
        }
        $cells = $base['cells'];
        $errors = [];
        $notes = [];

        // Name, texts.
        $name = CellParser::line($get($cells, 'name'));
        if ($name === '' && $existing !== null) {
            $name = $existing->name;
        }
        if ($name === '') {
            $errors[] = __('imports.name_missing');
        }
        if (mb_strlen($name) > 150) {
            $name = mb_substr($name, 0, 150);
            $notes[] = 'names_cut';
        }
        $description = CellParser::text($get($cells, 'description'));
        if (mb_strlen($description) > 10000) {
            $description = mb_substr($description, 0, 10000);
            $notes[] = 'names_cut';
        }
        $short = mb_substr(CellParser::line($get($cells, 'short_description')), 0, 300);

        // Variants: rows carrying option values.
        $optionNames = [];
        for ($n = 1; $n <= 3; $n++) {
            foreach ($rows as $row) {
                $label = CellParser::line($get($row['cells'], "option{$n}_name"));
                if ($label !== '') {
                    $optionNames[$n] = mb_substr($label, 0, 40);
                    break;
                }
            }
        }
        $variantRows = array_values(array_filter($rows, function (array $row) use ($get): bool {
            $v = CellParser::line($get($row['cells'], 'option1_value'));

            return $v !== '' && mb_strtolower($v) !== 'default title';
        }));
        if ($variantRows === [] || (count($optionNames) === 1 && mb_strtolower((string) reset($optionNames)) === 'title')) {
            $variantRows = [];
        }

        // Prices: the product's own, or the cheapest variant.
        $badPrice = false;
        $priceOf = function (array $row) use ($get, &$errors, &$badPrice): array {
            $price = CellParser::money($get($row['cells'], 'price'));
            $sale = CellParser::money($get($row['cells'], 'sale_price'));
            $compare = CellParser::money($get($row['cells'], 'compare_at_price'));
            foreach (['price' => $price, 'sale_price' => $sale, 'compare_at_price' => $compare] as $field => $value) {
                if ($value === false) {
                    $badPrice = true;
                    $errors[] = __('imports.price_invalid', ['value' => mb_substr($get($row['cells'], $field), 0, 30)]);
                }
            }
            $price = $price === false ? null : $price;
            $sale = $sale === false ? null : $sale;
            $compare = $compare === false ? null : $compare;
            if ($sale !== null && (float) $sale > 0) {
                if ($price !== null && (float) $sale < (float) $price) {
                    $compare ??= $price;
                    $price = $sale;
                } elseif ($price === null) {
                    $price = $sale;
                }
            }

            return [$price, $compare];
        };

        [$price, $compare] = $priceOf($base);
        $variantPrices = [];
        foreach ($variantRows as $i => $row) {
            [$vp] = $priceOf($row);
            if ($vp !== null) {
                $variantPrices[$i] = (float) $vp;
            }
        }
        if ($variantPrices !== [] && ($price === null || ! in_array((float) $price, $variantPrices, true))) {
            $price = number_format(min($variantPrices), 2, '.', '');
        }
        if ($price === null && $existing !== null) {
            $price = (string) $existing->price;
        }
        if ($price === null && ! $badPrice) {
            $errors[] = __('imports.price_missing');
        } elseif ($price === null) {
            // Already explained by the unreadable price.
        } elseif ((float) $price <= 0) {
            $errors[] = __('imports.price_zero');
        } elseif ((float) $price > self::MAX_PRICE) {
            $errors[] = __('imports.price_high');
        }
        if ($compare !== null && $price !== null && (float) $compare <= (float) $price) {
            $compare = null;
        }
        if ($compare !== null && (float) $compare > self::MAX_PRICE) {
            $compare = null;
        }

        // SKU, stock, status, slug, SEO.
        $sku = mb_substr(CellParser::line($get($cells, 'sku')), 0, 60) ?: null;
        $stock = CellParser::quantity($get($cells, 'stock'));
        if ($stock === false) {
            $errors[] = __('imports.stock_invalid', ['value' => mb_substr($get($cells, 'stock'), 0, 30)]);
            $stock = null;
        }
        $visible = CellParser::visible($get($cells, 'status')) ?? ($existing?->is_active ?? $visibleByDefault);
        $slugCell = mb_strtolower(CellParser::line($get($cells, 'slug')));
        $seoTitle = mb_substr(CellParser::line($get($cells, 'seo_title')), 0, 70);
        $seoDescription = mb_substr(CellParser::line($get($cells, 'seo_description')), 0, 170);

        $payload = [
            'name' => $name,
            'description' => $description !== '' ? $description : ($existing?->description),
            'price' => $price ?? '0',
            'compare_at_price' => $compare ?? ($existing !== null && ! isset($mapping['compare_at_price']) && ! isset($mapping['sale_price']) ? $existing->compare_at_price : null),
            'sku' => $sku ?? $existing?->sku,
            'is_active' => $visible,
        ];
        if ($short !== '') {
            $payload['short_description'] = $short;
        }
        if ($slugCell !== '' && preg_match('/^[a-z0-9\p{Arabic}]+(?:-[a-z0-9\p{Arabic}]+)*$/u', $slugCell) === 1 && mb_strlen($slugCell) <= 120) {
            $payload['slug'] = $slugCell;
        }
        if ($seoTitle !== '' || $seoDescription !== '') {
            $payload['seo'] = array_filter(['title' => $seoTitle ?: null, 'description' => $seoDescription ?: null]);
        }

        // Options and variant stock.
        if ($variantRows !== []) {
            [$options, $variants, $tracked, $rounded, $optionErrors] = $this->variants($variantRows, $optionNames, $get, $priceOf, (float) ($price ?? 0));
            array_push($errors, ...$optionErrors);
            if ($rounded) {
                $notes[] = 'prices_rounded';
            }
            if ($options !== []) {
                $payload['options'] = $options;
                $payload['stock_mode'] = $tracked ? Product::STOCK_VARIANT : Product::STOCK_UNLIMITED;
                if ($tracked) {
                    $payload['variants'] = $variants;
                }
                $payload['sku'] ??= $variants[0]['sku'] ?? null;
            }
        } elseif (isset($optionNames[1]) && ($single = CellParser::line($get($cells, 'option1_value'))) !== '' && str_contains($single, ',')) {
            // One row listing every value ("Red, Blue"): choices without their own stock.
            $payload['options'] = $this->listedOptions($cells, $optionNames, $get);
        }
        if (! isset($payload['stock_mode'])) {
            if ($stock !== null) {
                $payload['stock_mode'] = Product::STOCK_PRODUCT;
                $payload['stock'] = $stock;
            } elseif (isset($mapping['stock']) && $existing === null) {
                $payload['stock_mode'] = Product::STOCK_UNLIMITED;
            }
        }

        // Images from every row of the product (Shopify puts one image per row), then categories.
        $images = [];
        foreach ($rows as $row) {
            foreach ([...(array) ($mapping['images'] ?? []), ...(array) ($mapping['variant_image'] ?? [])] as $col) {
                array_push($images, ...CellParser::urls($row['cells'][$col] ?? ''));
            }
        }
        $images = array_values(array_unique($images));
        if (count($images) > self::MAX_IMAGES) {
            $images = array_slice($images, 0, self::MAX_IMAGES);
            $notes[] = 'images_skipped';
        }
        $categories = CellParser::categories($get($cells, 'category'));

        $identifier = $sku ?? ($get($cells, 'group') ?: ($get($cells, 'external_id') ?: null));

        return new ProductDraft(
            line: $base['line'],
            name: $name,
            sku: $sku,
            identifier: $identifier !== null ? mb_substr($identifier, 0, 150) : null,
            payload: $payload,
            images: $images,
            categories: $categories,
            errors: array_values(array_unique($errors)),
            notes: array_values(array_unique($notes)),
        );
    }

    /**
     * @param  list<array{line: int, cells: list<string>}>  $rows
     * @param  array<int, string>  $names  option number → name
     * @return array{0: list<array<string, mixed>>, 1: list<array<string, mixed>>, 2: bool, 3: bool, 4: list<string>}
     */
    private function variants(array $rows, array $names, callable $get, callable $priceOf, float $base): array
    {
        $errors = [];
        $values = [];   // option number → label → min price
        $variants = [];
        $tracked = false;
        $combos = [];

        foreach ($rows as $row) {
            $combo = [];
            [$price] = $priceOf($row);
            foreach ([1, 2, 3] as $n) {
                $label = mb_substr(CellParser::line($get($row['cells'], "option{$n}_value")), 0, 40);
                if ($label === '') {
                    continue;
                }
                $names[$n] ??= __('imports.option', ['n' => $n]);
                $values[$n][$label] = isset($values[$n][$label]) ? min($values[$n][$label], (float) ($price ?? $base)) : (float) ($price ?? $base);
                $combo[$names[$n]] = $label;
            }
            if ($combo === []) {
                continue;
            }
            $stock = CellParser::quantity($get($row['cells'], 'stock'));
            if ($stock !== null && $stock !== false) {
                $tracked = true;
            }
            $combos[] = ['values' => $combo, 'price' => (float) ($price ?? $base)];
            $variants[] = ['values' => $combo, 'stock' => is_int($stock) ? $stock : 0, 'sku' => mb_substr(CellParser::line($get($row['cells'], 'sku')), 0, 60) ?: null];
        }

        $options = [];
        foreach ($values as $n => $labels) {
            if (count($labels) > self::MAX_VALUES) {
                $errors[] = __('imports.too_many_values', ['option' => $names[$n], 'max' => self::MAX_VALUES]);
                $labels = array_slice($labels, 0, self::MAX_VALUES, true);
            }
            $options[] = [
                'name' => $names[$n],
                'display_type' => 'buttons',
                'is_required' => true,
                'values' => array_map(fn (string $label, float $p) => ['label' => (string) $label, 'price_delta' => number_format(max(-self::MAX_PRICE, $p - $base), 2, '.', '')], array_keys($labels), array_values($labels)),
            ];
        }

        // Does "base + each value's difference" give back every variant's own price?
        $deltas = [];
        foreach ($options as $option) {
            foreach ($option['values'] as $v) {
                $deltas[$option['name']][$v['label']] = (float) $v['price_delta'];
            }
        }
        $rounded = false;
        foreach ($combos as $combo) {
            $sum = $base;
            foreach ($combo['values'] as $opt => $label) {
                $sum += $deltas[$opt][$label] ?? 0;
            }
            if (abs($sum - $combo['price']) > 0.009) {
                $rounded = true;
                break;
            }
        }

        return [$options, $tracked ? $variants : [], $tracked, $rounded, $errors];
    }

    /**
     * @param  list<string>  $cells
     * @param  array<int, string>  $names
     * @return list<array<string, mixed>>
     */
    private function listedOptions(array $cells, array $names, callable $get): array
    {
        $options = [];
        foreach ([1, 2, 3] as $n) {
            if (! isset($names[$n])) {
                continue;
            }
            $labels = array_values(array_unique(array_filter(array_map(fn ($l) => mb_substr(trim($l), 0, 40), explode(',', CellParser::line($get($cells, "option{$n}_value")))))));
            if ($labels === []) {
                continue;
            }
            $options[] = [
                'name' => $names[$n],
                'display_type' => 'buttons',
                'is_required' => true,
                'values' => array_map(fn ($l) => ['label' => $l, 'price_delta' => '0.00'], array_slice($labels, 0, self::MAX_VALUES)),
            ];
        }

        return $options;
    }
}
