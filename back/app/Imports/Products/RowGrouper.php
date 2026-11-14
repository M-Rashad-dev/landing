<?php

declare(strict_types=1);

namespace App\Imports\Products;

/**
 * Puts the rows of one product together, in the order products first appear:
 * - rows sharing a group key (Shopify handle, our «كود التجميع»);
 * - WooCommerce variations (Parent "id:12") with their parent row (ID 12);
 * - rows with no name right under a product (variant / extra image rows without a key, as in Salla).
 * Anything else is a product on its own row.
 */
final class RowGrouper
{
    /**
     * @param  iterable<int, list<string>>  $rows  line → cells
     * @param  array<string, int|list<int>>  $mapping
     * @return list<list<array{line: int, cells: list<string>}>>
     */
    public function group(iterable $rows, array $mapping): array
    {
        $cell = fn (array $cells, string $field): string => isset($mapping[$field]) && is_int($mapping[$field]) ? trim($cells[$mapping[$field]] ?? '') : '';
        $groups = [];
        $index = [];
        $lastKey = null;

        foreach ($rows as $line => $cells) {
            $parent = (string) preg_replace('/^id:\s*/i', '', $cell($cells, 'parent'));
            $group = mb_strtolower($cell($cells, 'group'));
            $id = $cell($cells, 'external_id');
            $hasOptions = $cell($cells, 'option1_value') !== '' || $cell($cells, 'option2_value') !== '';

            $key = match (true) {
                $parent !== '' => 'p:'.mb_strtolower($parent),
                $group !== '' => 'g:'.$group,
                $id !== '' && isset($mapping['parent']) => 'p:'.mb_strtolower($id),
                // No name but a variant or an image: it continues the product above.
                $lastKey !== null && $cell($cells, 'name') === '' && ($hasOptions || $this->hasImage($cells, $mapping)) => $lastKey,
                default => 'r:'.$line,
            };
            // A Woo variation can reference its parent by SKU instead of id.
            if ($parent !== '' && ! isset($index[$key]) && isset($index['s:'.mb_strtolower($parent)])) {
                $key = $index['s:'.mb_strtolower($parent)];
            }

            if (! isset($index[$key])) {
                $index[$key] = count($groups);
                $groups[] = [];
                $sku = mb_strtolower($cell($cells, 'sku'));
                if ($sku !== '' && ! $hasOptions) {
                    $index['s:'.$sku] ??= $key;
                }
            }
            $groups[$index[$key]][] = ['line' => (int) $line, 'cells' => $cells];
            $lastKey = $key;
        }

        return $groups;
    }

    /**
     * @param  list<string>  $cells
     * @param  array<string, int|list<int>>  $mapping
     */
    private function hasImage(array $cells, array $mapping): bool
    {
        foreach ([...(array) ($mapping['images'] ?? []), ...(array) ($mapping['variant_image'] ?? [])] as $i) {
            if (trim($cells[$i] ?? '') !== '') {
                return true;
            }
        }

        return false;
    }
}
