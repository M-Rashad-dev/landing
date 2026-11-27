<?php

declare(strict_types=1);

namespace App\Themes\Store\Concerns;

use Illuminate\Validation\Rule;

/**
 * The «صفحة المنتج», «صفحات الأقسام» and «السلة» settings groups, for the store themes that draw
 * those pages their own way («شابع», «رواق»). The common keys are checked and stored here once; a
 * theme adds its own keys on top (its defaults fill what an older design is missing).
 */
trait PageSettingsGroups
{
    /** «بيتفرجوا على المنتج دلوقتي»: the highest number a merchant can set. */
    public const PAGE_VIEWERS_MAX = 999000;

    /** @return array<string, mixed> */
    protected function productPageRules(string $p): array
    {
        $k = "{$p}.settings.product_page";

        // Missing in designs saved before them: their defaults are used.
        return [
            $k => ['sometimes', 'array'],
            "{$k}.gallery" => ['sometimes', Rule::in(['thumbs', 'slider'])],
            "{$k}.zoom" => ['sometimes', 'boolean'],
            "{$k}.description" => ['sometimes', 'boolean'],
            "{$k}.reviews" => ['sometimes', 'boolean'],
            "{$k}.whatsapp_ask" => ['sometimes', 'boolean'],
            "{$k}.related_enabled" => ['sometimes', 'boolean'],
            "{$k}.related" => ['sometimes', Rule::in(['category', 'similar'])],
            "{$k}.sticky_bar" => ['sometimes', 'boolean'],
            "{$k}.sticky_buttons" => ['sometimes', Rule::in(['cart', 'both', 'buy'])],
            "{$k}.viewers.enabled" => ['sometimes', 'boolean'],
            "{$k}.viewers.min" => ['sometimes', 'integer', 'between:1,'.self::PAGE_VIEWERS_MAX],
            "{$k}.viewers.max" => ['sometimes', 'integer', 'between:1,'.self::PAGE_VIEWERS_MAX, 'gte:'.$k.'.viewers.min'],
            "{$k}.viewers.every" => ['sometimes', 'integer', 'between:3,300'],
        ];
    }

    /**
     * @param  array<string, mixed>  $g  what was saved
     * @param  array<string, mixed>  $defaults  the theme's PAGE_DEFAULTS
     * @return array<string, mixed>
     */
    protected function cleanProductPage(array $g, array $defaults): array
    {
        $g = [...$defaults, ...$g];
        $v = [...$defaults['viewers'], ...(array) $g['viewers']];

        return [
            'gallery' => (string) $g['gallery'],
            'zoom' => (bool) $g['zoom'],
            'description' => (bool) $g['description'],
            'reviews' => (bool) $g['reviews'],
            'whatsapp_ask' => (bool) $g['whatsapp_ask'],
            'related_enabled' => (bool) $g['related_enabled'],
            'related' => (string) $g['related'],
            'sticky_bar' => (bool) $g['sticky_bar'],
            'sticky_buttons' => (string) $g['sticky_buttons'],
            'viewers' => ['enabled' => (bool) $v['enabled'], 'min' => (int) $v['min'], 'max' => (int) $v['max'], 'every' => (int) $v['every']],
        ];
    }

    /** @return array<string, mixed> */
    protected function listingRules(string $p): array
    {
        $k = "{$p}.settings.listing";

        return [
            $k => ['sometimes', 'array'],
            "{$k}.columns_desktop" => ['sometimes', 'integer', 'between:2,5'],
            "{$k}.columns_mobile" => ['sometimes', 'integer', 'between:1,2'],
            "{$k}.banner" => ['sometimes', 'boolean'],
            "{$k}.subcategories" => ['sometimes', Rule::in(['circles', 'chips'])],
            "{$k}.filters" => ['sometimes', Rule::in(['open', 'button', 'hidden'])],
        ];
    }

    /**
     * @param  array<string, mixed>  $l
     * @param  array<string, mixed>  $defaults  the theme's LISTING_DEFAULTS
     * @return array<string, mixed>
     */
    protected function cleanListing(array $l, array $defaults): array
    {
        $l = [...$defaults, ...$l];

        return [
            'columns_desktop' => (int) $l['columns_desktop'],
            'columns_mobile' => (int) $l['columns_mobile'],
            'banner' => (bool) $l['banner'],
            'subcategories' => (string) $l['subcategories'],
            'filters' => (string) $l['filters'],
        ];
    }

    /**
     * The cart's common keys plus the theme's note switch (`kitchen_notes`, `order_notes`…).
     *
     * @return array<string, mixed>
     */
    protected function cartRules(string $p, string $notesKey): array
    {
        $k = "{$p}.settings.cart";

        return [
            $k => ['sometimes', 'array'],
            "{$k}.free_shipping_bar" => ['sometimes', 'boolean'],
            "{$k}.suggestions_enabled" => ['sometimes', 'boolean'],
            "{$k}.suggestions" => ['sometimes', Rule::in(['offers', 'latest'])],
            "{$k}.{$notesKey}" => ['sometimes', 'boolean'],
        ];
    }

    /**
     * @param  array<string, mixed>  $c
     * @param  array<string, mixed>  $defaults  the theme's CART_DEFAULTS
     * @return array<string, mixed>
     */
    protected function cleanCart(array $c, array $defaults, string $notesKey): array
    {
        $c = [...$defaults, ...$c];

        return [
            'free_shipping_bar' => (bool) $c['free_shipping_bar'],
            'suggestions_enabled' => (bool) $c['suggestions_enabled'],
            'suggestions' => (string) $c['suggestions'],
            $notesKey => (bool) $c[$notesKey],
        ];
    }
}
