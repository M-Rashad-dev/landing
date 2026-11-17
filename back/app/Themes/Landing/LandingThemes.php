<?php

declare(strict_types=1);

namespace App\Themes\Landing;

use App\Models\Product;
use App\Services\PageContentSanitizer;

/**
 * Every landing theme by key: the only place that picks a landing theme's design. A new landing
 * theme is one class implementing LandingThemeDesign, added to THEMES (plus its ThemeSeeder row).
 * A key the code has no design for keeps the generic section sanitizer. One place for create,
 * save and publish.
 */
final class LandingThemes
{
    /** @var list<class-string<LandingThemeDesign>> */
    public const THEMES = [BidayaLandingDesign::class, ShabeLandingDesign::class, SufiLandingDesign::class];

    public function __construct(private readonly PageContentSanitizer $generic) {}

    /** The design of a theme, or null when the code has none for the key. */
    public function for(string $key): ?LandingThemeDesign
    {
        foreach (self::THEMES as $class) {
            if ($class::KEY === $key) {
                return app($class);
            }
        }

        return null;
    }

    /** @return list<string> */
    public static function keys(): array
    {
        return array_map(fn (string $class) => $class::KEY, self::THEMES);
    }

    /** What a new page on a theme starts with. @return array<string, mixed> */
    public function starter(string $themeKey, ?Product $product): array
    {
        $design = $this->for($themeKey);

        return $design ? $design::defaults($product?->name) : ['version' => 1, 'sections' => []];
    }

    /**
     * Validated, cleaned content for the theme.
     *
     * @return array<string, mixed>
     */
    public function clean(string $themeKey, mixed $content, string $prefix = 'content', string $kind = 'landing'): array
    {
        $design = $this->for($themeKey);

        return $design ? $design->validate($content, $prefix) : $this->generic->sanitize($content, $prefix, $kind)['content'];
    }
}
