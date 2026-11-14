<?php

declare(strict_types=1);

namespace App\Imports\Products;

/**
 * Knows the product fields an import can fill and guesses which column holds each one, from
 * Arabic / English names however they are written ("سعر المنتج", "Variant Price", "price_ar"…).
 * Recognises exports of Shopify (old and 2024 headers), WooCommerce, Salla, Zid and our own
 * template, so a file exported elsewhere maps itself; the merchant can still change any column.
 */
final class ColumnMapper
{
    /** Fields, in the order the mapping screen shows them. `images` may take several columns. */
    public const FIELDS = [
        'name', 'price', 'sale_price', 'compare_at_price', 'sku', 'stock', 'description', 'short_description', 'category', 'images',
        'group', 'external_id', 'parent', 'option1_name', 'option1_value', 'option2_name', 'option2_value', 'option3_name', 'option3_value',
        'variant_image', 'status', 'slug', 'seo_title', 'seo_description',
    ];

    public const MULTI = ['images'];

    /**
     * Header names per field (compared after normalize()); earlier names win when two columns
     * could fit the same field.
     *
     * @var array<string, list<string>>
     */
    private const SYNONYMS = [
        'name' => ['اسم المنتج', 'أسم المنتج', 'المنتج', 'الاسم', 'اسم', 'name', 'title', 'product name', 'product title', 'name ar', 'name_ar', 'arabic name', 'الاسم بالعربي', 'اسم المنتج بالعربي', 'product'],
        'price' => ['السعر', 'سعر المنتج', 'سعر البيع', 'السعر الاساسي', 'price', 'variant price', 'regular price', 'selling price', 'unit price', 'السعر الأصلي'],
        'sale_price' => ['السعر بعد الخصم', 'السعر المخفض', 'سعر الخصم', 'سعر العرض', 'sale price', 'discount price', 'special price', 'offer price', 'price after discount'],
        'compare_at_price' => ['السعر قبل الخصم', 'السعر القديم', 'سعر المقارنه', 'compare at price', 'compare-at price', 'variant compare at price', 'old price', 'original price', 'list price', 'msrp'],
        'sku' => ['sku', 'variant sku', 'رمز المنتج', 'رمز المنتج sku', 'كود المنتج', 'الكود', 'رقم المنتج sku', 'product code', 'item code', 'كود', 'الباركود', 'barcode', 'barcodes', 'variant barcode'],
        'stock' => ['الكميه', 'الكمية المتوفره', 'الكمية المتاحه', 'المخزون', 'الكميه المتاحه', 'quantity', 'qty', 'stock', 'stock quantity', 'inventory', 'inventory quantity', 'variant inventory qty', 'in stock qty'],
        'description' => ['الوصف', 'وصف المنتج', 'التفاصيل', 'description', 'body html', 'body (html)', 'body', 'product description', 'description ar', 'description_ar', 'long description', 'الوصف بالعربي'],
        'short_description' => ['وصف مختصر', 'الوصف المختصر', 'نبذه', 'short description', 'summary', 'العنوان الترويجي', 'subtitle'],
        'category' => ['التصنيف', 'تصنيف المنتج', 'التصنيفات', 'القسم', 'الفئه', 'category', 'categories', 'collection', 'collections', 'product category', 'type', 'product type', 'نوع المنتج'],
        'images' => ['الصور', 'صوره المنتج', 'صور المنتج', 'الصوره', 'رابط الصوره', 'images', 'image', 'image src', 'image url', 'product image url', 'image link', 'photos', 'main image', 'featured image', 'gallery'],
        'group' => ['كود التجميع', 'handle', 'url handle', 'المعرف', 'group', 'product handle', 'parent sku', 'item group id'],
        'external_id' => ['id', 'product id', 'رقم', 'المعرف الرقمي', 'رقم المنتج'],
        'parent' => ['parent', 'parent id', 'المنتج الرئيسي', 'المنتج الاب'],
        'option1_name' => ['اسم الخيار 1', 'option1 name', 'attribute 1 name', 'الخيار 1', '[1] الاسم', 'variant 1 name'],
        'option1_value' => ['قيمه الخيار 1', 'option1 value', 'attribute 1 value(s)', 'attribute 1 values', '[1] القيمه', 'variant 1 value'],
        'option2_name' => ['اسم الخيار 2', 'option2 name', 'attribute 2 name', 'الخيار 2', '[2] الاسم', 'variant 2 name'],
        'option2_value' => ['قيمه الخيار 2', 'option2 value', 'attribute 2 value(s)', 'attribute 2 values', '[2] القيمه', 'variant 2 value'],
        'option3_name' => ['اسم الخيار 3', 'option3 name', 'attribute 3 name', 'الخيار 3', '[3] الاسم', 'variant 3 name'],
        'option3_value' => ['قيمه الخيار 3', 'option3 value', 'attribute 3 value(s)', 'attribute 3 values', '[3] القيمه', 'variant 3 value'],
        'variant_image' => ['صوره الخيار', 'variant image', 'variant image url'],
        'status' => ['الحاله', 'الظهور', 'ظاهر', 'منشور', 'status', 'published', 'published on online store', 'visibility', 'active', 'is active', 'enabled', 'visible'],
        'slug' => ['الرابط', 'رابط المنتج', 'slug', 'permalink', 'url key'],
        'seo_title' => ['عنوان السيو', 'عنوان محركات البحث', 'seo title', 'meta title', 'page title'],
        'seo_description' => ['وصف السيو', 'وصف محركات البحث', 'seo description', 'meta description'],
    ];

    /** Names only matched exactly (too generic to match as part of a longer header). */
    private const EXACT_ONLY = [
        'id', 'رقم', 'type', 'body', 'name', 'title', 'image', 'كود', 'اسم', 'product', 'active', 'visible', 'group', 'parent', 'price',
        'المنتج', 'الاسم', 'السعر', 'stock', 'الوصف', 'description', 'الصوره', 'الكود', 'الحاله', 'status', 'category', 'التصنيف',
    ];

    /** Lower-cased Latin, no Arabic diacritics / tatweel, unified alef / ya / ta marbuta, single spaces. */
    public static function normalize(string $header): string
    {
        $h = mb_strtolower(trim($header));
        $h = (string) preg_replace('/[\x{064B}-\x{065F}\x{0670}\x{0640}]/u', '', $h);
        $h = strtr($h, ['أ' => 'ا', 'إ' => 'ا', 'آ' => 'ا', 'ى' => 'ي', 'ة' => 'ه', 'ـ' => '']);
        $h = str_replace(['_', '-', ':', '*', '؟', '?'], ' ', $h);

        return trim((string) preg_replace('/\s+/u', ' ', $h));
    }

    /**
     * Best column per field (field → column index, or list of indexes for multi fields).
     *
     * @param  list<string>  $headers
     * @return array<string, int|list<int>>
     */
    public function guess(array $headers, string $source = 'generic'): array
    {
        $normalized = array_map(self::normalize(...), $headers);
        $taken = [];
        $mapping = [];

        // Pass 1: exact names; pass 2: a known name inside a longer header.
        foreach ([true, false] as $exact) {
            foreach (self::FIELDS as $field) {
                if (isset($mapping[$field]) && ! in_array($field, self::MULTI, true)) {
                    continue;
                }
                foreach ($this->synonyms($field, $source) as $synonym) {
                    $syn = self::normalize($synonym);
                    foreach ($normalized as $i => $h) {
                        if (isset($taken[$i]) || $h === '') {
                            continue;
                        }
                        $hit = $exact ? $h === $syn : (! in_array($syn, self::EXACT_ONLY, true) && mb_strlen($syn) >= 3 && str_contains($h, $syn));
                        if (! $hit) {
                            continue;
                        }
                        $taken[$i] = true;
                        if (in_array($field, self::MULTI, true)) {
                            $mapping[$field] = [...(array) ($mapping[$field] ?? []), $i];

                            continue;
                        }
                        $mapping[$field] = $i;

                        continue 3;
                    }
                }
            }
        }

        return array_filter($mapping, fn ($v) => $v !== null && $v !== []);
    }

    /**
     * Which platform exported the file, from its headers.
     *
     * @param  list<string>  $headers
     */
    public function detectSource(array $headers): string
    {
        $set = array_flip(array_map(self::normalize(...), $headers));
        $has = fn (string ...$names): bool => array_reduce($names, fn (bool $ok, string $n) => $ok && isset($set[self::normalize($n)]), true);

        return match (true) {
            $has('كود التجميع', 'اسم المنتج', 'السعر') => 'maksab',
            ($has('handle') || $has('url handle')) && ($has('variant price') || $has('option1 value') || $has('title')) => 'shopify',
            $has('regular price') && ($has('attribute 1 name') || $has('parent') || $has('sale price')) => 'woocommerce',
            $has('name ar') || $has('name_ar') || ($has('sku') && $has('description ar')) => 'zid',
            $has('رمز المنتج sku') || ($has('النوع') && $has('سعر المنتج')) => 'salla',
            default => 'generic',
        };
    }

    /** @return list<string> */
    private function synonyms(string $field, string $source): array
    {
        $list = self::SYNONYMS[$field] ?? [];
        // Woo's "Type" is simple / variable / variation, never a category.
        if ($source === 'woocommerce' && $field === 'category') {
            $list = array_values(array_diff($list, ['type', 'product type']));
        }
        // Shopify's "Product category" is Google's taxonomy; the merchant's own grouping is "Type".
        if ($source === 'shopify' && $field === 'category') {
            $list = ['type', 'product type', 'collection', 'product category'];
        }
        // Shopify's Barcode is not the SKU when a SKU column exists.
        if ($source === 'shopify' && $field === 'sku') {
            $list = ['variant sku', 'sku'];
        }

        return $list;
    }
}
