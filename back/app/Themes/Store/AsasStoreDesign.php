<?php

declare(strict_types=1);

namespace App\Themes\Store;

/**
 * «أساس», the free store theme: four home section types and the base settings only.
 */
final class AsasStoreDesign extends StoreThemeDesign
{
    public const KEY = 'asas_store';

    public const SECTION_TYPES = ['banner', 'products', 'features', 'testimonials'];

    public const MAX_SECTIONS = 20;

    /** @return array{settings: array<string, mixed>, sections: list<array<string, mixed>>} */
    public function defaults(?int $logoMediaId = null): array
    {
        return [
            // «نعناع», the platform colors (owner decision: the default of «أساس»).
            'settings' => self::baseDefaults($logoMediaId),
            'sections' => [
                self::section('banner', ['slides' => [], 'autoplay' => true]),
                self::section('products', [
                    'title' => __('design.products_title'),
                    'description' => __('design.products_description'),
                    'source' => 'latest',
                    'category_id' => null,
                    'limit' => 8,
                    'layout' => 'grid',
                    'columns' => 4,
                    'show_view_all' => true,
                ]),
                self::section('features', ['title' => null, 'items' => (array) __('design.features')]),
                self::section('testimonials', ['title' => __('design.testimonials_title'), 'source' => 'auto', 'items' => []]),
            ],
        ];
    }

    /** @param array<string, mixed> $settings @return array<string, mixed> */
    protected function settingsRules(string $p, array $settings): array
    {
        return $this->baseSettingsRules($p);
    }

    /** @param array<string, mixed> $s @return array<string, mixed> */
    protected function cleanSettings(array $s): array
    {
        return $this->cleanBaseSettings($s);
    }
}
