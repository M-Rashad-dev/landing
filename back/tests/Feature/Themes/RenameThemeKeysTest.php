<?php

declare(strict_types=1);

use App\Models\LandingPage;
use App\Models\Store;
use App\Models\Tenant;
use App\Models\Theme;
use App\Models\ThemePurchase;

// The 2026-11-17 migration that puts the kind in every theme key (sufi → sufi_store…).
function renameThemeKeys(): object
{
    return require database_path('migrations/2026_11_28_100001_rename_theme_keys_with_kind.php');
}

it('moves themes, purchases, stores and live pages to the keys with the kind', function () {
    // A database from before: «شابع» only under its old key, «صوفي» under both (seeded again).
    Theme::query()->whereKey('shabe_landing')->update(['key' => 'shabe']);
    Theme::query()->create(['key' => 'sufi', 'name' => 'صوفي', 'is_active' => true]);
    $tenant = Tenant::factory()->create();
    asTenant($tenant, function () {
        ThemePurchase::query()->create(['theme_key' => 'sufi', 'source' => 'purchase', 'price_paid' => 990]);
        ThemePurchase::query()->create(['theme_key' => 'shabe', 'source' => 'purchase', 'price_paid' => 100]);
        Store::query()->create(['is_enabled' => true, 'theme_key' => 'sufi']);
        LandingPage::factory()->published()->create(['slug' => 'box', 'theme_key' => 'shabe', 'published_content' => ['version' => 1, 'sections' => [], 'theme_key' => 'shabe']]);
    });
    $price = Theme::query()->findOrFail('shabe')->price;

    renameThemeKeys()->up();

    expect(Theme::query()->whereKey(['sufi', 'shabe'])->count())->toBe(0)
        ->and(Theme::query()->findOrFail('shabe_landing')->price)->toEqual($price)
        ->and(Theme::query()->findOrFail('shabe_landing')->tags()->pluck('slug')->all())->toBe(['food']);
    asTenant($tenant, function () {
        expect(ThemePurchase::query()->orderBy('theme_key')->pluck('theme_key')->all())->toBe(['shabe_landing', 'sufi_store'])
            ->and(Store::query()->firstOrFail()->theme_key)->toBe('sufi_store');
        $page = LandingPage::query()->where('slug', 'box')->firstOrFail();
        expect($page->theme_key)->toBe('shabe_landing')->and($page->published_content['theme_key'])->toBe('shabe_landing');
    });
});

it('does nothing on a database that already has the new keys', function () {
    $before = Theme::query()->orderBy('key')->pluck('key')->all();

    renameThemeKeys()->up();

    expect(Theme::query()->orderBy('key')->pluck('key')->all())->toBe($before)->toContain('asas_store', 'sufi_store', 'bidaya_landing', 'shabe_landing');
});
