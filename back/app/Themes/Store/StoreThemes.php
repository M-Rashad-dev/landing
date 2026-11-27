<?php

declare(strict_types=1);

namespace App\Themes\Store;

/**
 * Every store theme by key: the only place that picks a store theme's design. A new store theme is
 * one class extending StoreThemeDesign, added to THEMES (plus its ThemeSeeder row).
 */
final class StoreThemes
{
    /** @var list<class-string<StoreThemeDesign>> */
    public const THEMES = [AsasStoreDesign::class, SufiStoreDesign::class, ShabeStoreDesign::class, RawaqStoreDesign::class];

    /** The free theme every store starts with, and the fallback for a key the code no longer has. */
    public const DEFAULT = AsasStoreDesign::KEY;

    /** The design of a theme (the default theme for an unknown key). */
    public function for(string $key): StoreThemeDesign
    {
        foreach (self::THEMES as $class) {
            if ($class::KEY === $key) {
                return app($class);
            }
        }

        return app(AsasStoreDesign::class);
    }

    /** @return list<string> */
    public static function keys(): array
    {
        return array_map(fn (string $class) => $class::KEY, self::THEMES);
    }
}
