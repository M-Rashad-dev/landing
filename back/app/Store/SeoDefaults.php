<?php

declare(strict_types=1);

namespace App\Store;

use App\Models\Category;
use App\Models\Identity;
use App\Models\Product;
use App\Models\Tenant;
use App\Support\PlainText;
use App\Tenancy\Tenancy;
use Illuminate\Support\Str;

/**
 * Automatic SEO for products and categories: what the store shows when the owner left a field
 * empty (empty = automatic). Built from the item's own data, so it follows every edit:
 * title "name | store", a description from the text (or a sentence when there is none),
 * and keywords from the name, the categories and the store name.
 */
final class SeoDefaults
{
    private const TITLE_MAX = 70;

    private const DESCRIPTION_MAX = 160;

    private const KEYWORDS_MAX = 8;

    /** The store's public name: the default identity's brand name, else the account name. */
    public function storeName(): string
    {
        $identity = Identity::query()->where('is_default', true)->first() ?? Identity::query()->first();
        $brand = trim((string) ($identity?->brand_name ?? ''));

        return $brand !== '' ? $brand : (string) Tenant::query()->whereKey(Tenancy::id())->value('name');
    }

    /**
     * Needs the product's categories loaded (the main one first in the keywords).
     *
     * @return array{title: string, description: string, keywords: list<string>}
     */
    public function product(Product $product, string $store): array
    {
        $categories = $product->relationLoaded('categories') ? $product->categories : $product->categories()->get();
        $main = $categories->firstWhere('id', $product->primary_category_id) ?? $categories->first();
        $names = collect([$main?->name])->merge($categories->pluck('name'))->filter()->unique()->values()->all();

        $text = trim((string) $product->short_description);
        $description = $text !== '' ? Str::limit($text, self::DESCRIPTION_MAX, '…', preserveWords: true) : PlainText::fromMarkdown($product->description, self::DESCRIPTION_MAX);
        if ($description === '') {
            $description = __('store.seo_product_description', ['name' => $product->name, 'price' => $this->price($product), 'store' => $store]);
        }

        return [
            'title' => $this->title($product->name, $store),
            'description' => $description,
            'keywords' => $this->keywords([$product->name, ...$names, $store]),
        ];
    }

    /**
     * @param  list<string>  $ancestors  names of the parent categories, nearest first
     * @return array{title: string, description: string, keywords: list<string>}
     */
    public function category(Category $category, string $store, array $ancestors = []): array
    {
        $description = PlainText::fromMarkdown($category->description, self::DESCRIPTION_MAX);
        if ($description === '') {
            $description = __('store.seo_category_description', ['name' => $category->name, 'store' => $store]);
        }

        return [
            'title' => $this->title($category->name, $store),
            'description' => $description,
            'keywords' => $this->keywords([$category->name, ...$ancestors, $store]),
        ];
    }

    /**
     * The owner's values over the automatic ones (keywords: the owner's list when given).
     *
     * @param  array<string, mixed>|null  $seo
     * @param  array{title: string, description: string, keywords: list<string>}  $defaults
     * @return array<string, mixed>
     */
    public static function merge(?array $seo, array $defaults): array
    {
        $seo ??= [];
        foreach (['title', 'description', 'keywords'] as $key) {
            if (! isset($seo[$key]) || $seo[$key] === '' || $seo[$key] === []) {
                $seo[$key] = $defaults[$key];
            }
        }

        return $seo;
    }

    private function title(string $name, string $store): string
    {
        $suffix = $store !== '' ? " | {$store}" : '';
        $room = self::TITLE_MAX - mb_strlen($suffix);

        return ($room > 10 ? Str::limit($name, $room, '…') : Str::limit($name, self::TITLE_MAX, '…')).($room > 10 ? $suffix : '');
    }

    /**
     * @param  list<string|null>  $words
     * @return list<string>
     */
    private function keywords(array $words): array
    {
        $out = [];
        foreach ($words as $word) {
            $word = trim((string) $word);
            if ($word !== '' && ! in_array(mb_strtolower($word), array_map('mb_strtolower', $out), true)) {
                $out[] = $word;
            }
        }

        return array_slice($out, 0, self::KEYWORDS_MAX);
    }

    private function price(Product $product): string
    {
        $cents = $product->priceCents();

        return $cents % 100 === 0 ? number_format(intdiv($cents, 100)) : number_format($cents / 100, 2);
    }
}
