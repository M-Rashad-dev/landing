<?php

declare(strict_types=1);

use App\Models\Theme;
use App\Themes\Store\AsasStoreDesign;
use App\Themes\Store\StoreSections;
use App\Themes\Store\StoreThemeDesign;
use App\Themes\Store\StoreThemes;
use Laravel\Sanctum\Sanctum;

// What every registered store theme must keep true: a new theme that breaks one of these fails here.

it('gives every registered store theme a starter design that passes its own validation unchanged', function () {
    foreach (StoreThemes::THEMES as $class) {
        /** @var StoreThemeDesign $theme */
        $theme = app($class);
        $defaults = $theme->defaults(null);

        expect($theme->validate($defaults))->toBe($defaults, $class::KEY.': the starter design changes when saved')
            ->and(collect($defaults['sections'])->pluck('type')->diff($class::SECTION_TYPES)->all())->toBe([], $class::KEY.': a starter section it does not offer');
    }
});

it('knows how to check and store every section type a store theme offers', function () {
    $sections = app(StoreSections::class);
    foreach (StoreThemes::THEMES as $class) {
        expect($class::KEY)->toEndWith('_store')
            ->and($class::SETTINGS_GROUPS)->toContain('look', 'header', 'footer', 'general');
        foreach ($class::SECTION_TYPES as $type) {
            expect($sections->rules($type, 's', []))->not->toBe([], $class::KEY.": no rules for «{$type}»");
        }
    }
});

it('has a store theme row for every theme in the code, and falls back to «أساس» for a key it no longer has', function () {
    foreach (StoreThemes::keys() as $key) {
        expect(Theme::query()->find($key)?->kind)->toBe('store', "no store row for {$key}");
    }

    expect(app(StoreThemes::class)->for('gone_store'))->toBeInstanceOf(AsasStoreDesign::class)
        ->and(StoreThemes::DEFAULT)->toBe(AsasStoreDesign::KEY);
});

it('refuses switching a store to a theme row the code does not have', function () {
    $owner = createOwner();
    Theme::query()->create(['key' => 'ghost_store', 'name' => 'شبح', 'kind' => 'store', 'is_active' => true, 'price' => 0, 'is_listed' => true]);
    Sanctum::actingAs($owner);
    $this->getJson('/api/v1/dashboard/store')->assertOk();

    $this->putJson('/api/v1/dashboard/store', ['theme_key' => 'ghost_store'])->assertStatus(422)->assertJsonValidationErrors(['theme_key']);
});
