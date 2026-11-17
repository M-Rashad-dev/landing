<?php

declare(strict_types=1);

namespace App\Themes\Landing;

use App\Models\Product;
use App\Services\PageContentSanitizer;

/**
 * The landing themes that own their content shape («بداية» and «شابع») validate it themselves; any
 * other theme keeps the generic section sanitizer. One place for create, save and publish.
 */
final class LandingThemes
{
    public function __construct(
        private readonly PageContentSanitizer $generic,
        private readonly BidayaLandingDesign $bidaya,
        private readonly ShabeLandingDesign $shabe,
    ) {}

    /** What a new page on a theme starts with. @return array<string, mixed> */
    public function starter(string $themeKey, ?Product $product): array
    {
        return match ($themeKey) {
            BidayaLandingDesign::KEY => BidayaLandingDesign::defaults($product?->name),
            ShabeLandingDesign::KEY => ShabeLandingDesign::defaults($product?->name),
            default => ['version' => 1, 'sections' => []],
        };
    }

    /**
     * Validated, cleaned content for the theme.
     *
     * @return array<string, mixed>
     */
    public function clean(string $themeKey, mixed $content, string $prefix = 'content', string $kind = 'landing'): array
    {
        return match ($themeKey) {
            BidayaLandingDesign::KEY => $this->bidaya->validate($content, $prefix),
            ShabeLandingDesign::KEY => $this->shabe->validate($content, $prefix),
            default => $this->generic->sanitize($content, $prefix, $kind)['content'],
        };
    }
}
