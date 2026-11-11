<?php

declare(strict_types=1);

namespace App\Support;

/**
 * Cleans the SEO block of a product or category before saving: empty fields are dropped
 * (an empty field means "automatic", see App\Store\SeoDefaults), keywords are trimmed and unique.
 */
final class SeoInput
{
    /** @return array<string, mixed>|null */
    public static function clean(mixed $seo): ?array
    {
        if (! is_array($seo)) {
            return null;
        }

        if (array_key_exists('keywords', $seo)) {
            $words = [];
            foreach ((array) ($seo['keywords'] ?? []) as $word) {
                $word = is_string($word) ? trim(strip_tags($word)) : '';
                if ($word !== '' && ! in_array(mb_strtolower($word), array_map('mb_strtolower', $words), true)) {
                    $words[] = $word;
                }
            }
            $seo['keywords'] = $words;
        }

        foreach (['title', 'description'] as $key) {
            if (isset($seo[$key]) && is_string($seo[$key])) {
                $seo[$key] = trim(strip_tags($seo[$key]));
            }
        }

        $seo = array_filter($seo, fn ($v) => $v !== null && $v !== '' && $v !== []);

        return $seo === [] ? null : $seo;
    }
}
