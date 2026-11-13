<?php

declare(strict_types=1);

namespace App\Themes;

use App\Models\Product;
use Illuminate\Support\Str;

/**
 * What a new landing page starts with, per theme. Empty props fall back to the theme's own
 * defaults when it draws the page; only the product name is written in so the page reads right
 * from the first preview.
 */
final class LandingStarter
{
    /** «بداية»: header, five sections, the order form (always there) and the footer. */
    private const BIDAYA = ['header', 'hero', 'features', 'gallery', 'testimonials', 'faq', 'order_form', 'footer'];

    /** @return array{version: int, sections: list<array<string, mixed>>} */
    public static function content(string $themeKey, ?Product $product): array
    {
        $types = match ($themeKey) {
            'bidaya' => self::BIDAYA,
            default => [],
        };

        $sections = [];
        foreach ($types as $type) {
            $sections[] = [
                'id' => (string) Str::uuid(),
                'type' => $type,
                'variant' => 'default',
                'visible' => true,
                'props' => $type === 'hero' && $product !== null ? ['title' => $product->name] : [],
            ];
        }

        return ['version' => 1, 'sections' => $sections];
    }
}
