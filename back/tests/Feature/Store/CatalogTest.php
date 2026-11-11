<?php

declare(strict_types=1);

use App\Models\Identity;
use App\Models\Product;
use App\Models\StockMovement;
use App\Store\SeoDefaults;

/*
 * Products and categories screens (front-v2): main category, delete with or without
 * sub-categories, list tabs and filters, card quick edit, bulk actions, automatic SEO.
 */

function catalogCategory(string $name, ?int $parent = null): int
{
    return test()->postJson('/api/v1/dashboard/categories', ['name' => $name, 'parent_id' => $parent])->assertCreated()->json('data.id');
}

function catalogProduct(array $data = []): int
{
    return test()->postJson('/api/v1/dashboard/products', ['name' => 'منتج', 'price' => 100, ...$data])->assertCreated()->json('data.id');
}

function catalogVariant(array $stocks, ?int $threshold = null): int
{
    $labels = array_keys($stocks);

    return catalogProduct([
        'name' => 'تيشيرت', 'stock_mode' => 'variant', 'low_stock_threshold' => $threshold,
        'options' => [['name' => 'المقاس', 'display_type' => 'buttons', 'is_required' => true, 'values' => array_map(fn ($l) => ['label' => $l], $labels)]],
        'variants' => array_map(fn ($l) => ['values' => ['المقاس' => $l], 'stock' => $stocks[$l]], $labels),
    ]);
}

beforeEach(function () {
    $this->user = actingAsOwner();
});

// --- main category ---------------------------------------------------------------------------

it('keeps a main category among the product categories', function () {
    $a = catalogCategory('رجالي');
    $b = catalogCategory('تيشيرتات');

    $id = $this->postJson('/api/v1/dashboard/products', ['name' => 'قميص', 'price' => 200, 'category_ids' => [$a, $b], 'primary_category_id' => $b])
        ->assertCreated()->assertJsonPath('data.primary_category_id', $b)->json('data.id');

    // Without a choice: the first one.
    $this->postJson('/api/v1/dashboard/products', ['name' => 'بنطلون', 'price' => 200, 'category_ids' => [$a, $b]])
        ->assertCreated()->assertJsonPath('data.primary_category_id', $a);

    // The main one must be one of its categories.
    $this->putJson("/api/v1/dashboard/products/{$id}", ['name' => 'قميص', 'price' => 200, 'category_ids' => [$a], 'primary_category_id' => $b])
        ->assertStatus(422)->assertJsonValidationErrors('primary_category_id');

    // Removing the main category: the remaining one takes over.
    $this->putJson("/api/v1/dashboard/products/{$id}", ['name' => 'قميص', 'price' => 200, 'category_ids' => [$a]])
        ->assertOk()->assertJsonPath('data.primary_category_id', $a);
    $this->putJson("/api/v1/dashboard/products/{$id}", ['name' => 'قميص', 'price' => 200, 'category_ids' => []])
        ->assertOk()->assertJsonPath('data.primary_category_id', null);
});

// --- deleting categories -------------------------------------------------------------------

it('deletes a category and moves its sub-categories one level up by default', function () {
    $root = catalogCategory('ملابس');
    $child = catalogCategory('رجالي', $root);
    $grand = catalogCategory('قمصان', $child);
    $p = catalogProduct(['category_ids' => [$child, $grand], 'primary_category_id' => $child]);

    $this->deleteJson("/api/v1/dashboard/categories/{$child}")->assertNoContent();

    $rows = collect($this->getJson('/api/v1/dashboard/categories')->assertOk()->json('data'))->keyBy('id');
    expect($rows->keys()->all())->toBe([$root, $grand])
        ->and($rows[$grand]['parent_id'])->toBe($root)
        ->and($rows[$grand]['depth'])->toBe(1);
    // The product stays, in its other category, which became its main one.
    $this->getJson("/api/v1/dashboard/products/{$p}")->assertOk()->assertJsonPath('data.category_ids', [$grand])->assertJsonPath('data.primary_category_id', $grand);
});

it('deletes a category with every level under it, never the products', function () {
    $root = catalogCategory('ملابس');
    $child = catalogCategory('رجالي', $root);
    $grand = catalogCategory('قمصان', $child);
    $deep = catalogCategory('كم طويل', $grand);
    $other = catalogCategory('عروض');
    $p = catalogProduct(['category_ids' => [$deep, $other], 'primary_category_id' => $deep]);

    $this->deleteJson("/api/v1/dashboard/categories/{$child}?children=delete")->assertNoContent();

    expect(collect($this->getJson('/api/v1/dashboard/categories')->json('data'))->pluck('id')->all())->toBe([$root, $other]);
    $this->getJson("/api/v1/dashboard/products/{$p}")->assertOk()->assertJsonPath('data.category_ids', [$other])->assertJsonPath('data.primary_category_id', $other);

    $this->deleteJson("/api/v1/dashboard/categories/{$root}?children=everything")->assertStatus(422)->assertJsonValidationErrors('children');
});

it('isolates category deletion between stores', function () {
    $id = catalogCategory('ملابس');
    actingAsOwner();
    $this->deleteJson("/api/v1/dashboard/categories/{$id}?children=delete")->assertNotFound();
});

// --- the list --------------------------------------------------------------------------------

it('lists products with tabs, counts, category (with sub-categories), search and sort', function () {
    $men = catalogCategory('رجالي');
    $shirts = catalogCategory('قمصان', $men);

    $unlimited = catalogProduct(['name' => 'ساعة', 'price' => 900]);
    $out = catalogProduct(['name' => 'قميص أبيض', 'price' => 300, 'stock_mode' => 'product', 'stock' => 0, 'category_ids' => [$shirts]]);
    $low = catalogProduct(['name' => 'قميص أزرق', 'price' => 250, 'stock_mode' => 'product', 'stock' => 3, 'category_ids' => [$men]]);
    $ownAlert = catalogProduct(['name' => 'حزام', 'price' => 120, 'stock_mode' => 'product', 'stock' => 8, 'low_stock_threshold' => 10]);
    $plenty = catalogProduct(['name' => 'جاكيت', 'price' => 1200, 'stock_mode' => 'product', 'stock' => 50, 'is_active' => false]);
    $variantLow = catalogVariant(['S' => 0, 'M' => 20]);
    $variantOut = catalogVariant(['S' => 0, 'M' => 0]);

    $ids = fn (string $query) => collect($this->getJson("/api/v1/dashboard/products?{$query}")->assertOk()->json('data'))->pluck('id')->sort()->values()->all();

    expect($ids('status=out'))->toBe(collect([$out, $variantOut])->sort()->values()->all())
        ->and($ids('status=low'))->toBe(collect([$low, $ownAlert, $variantLow])->sort()->values()->all())
        ->and($ids('status=inactive'))->toBe([$plenty])
        ->and($ids("category_id={$men}"))->toBe(collect([$out, $low])->sort()->values()->all())
        ->and($ids('q='.urlencode('قميص')))->toBe(collect([$out, $low])->sort()->values()->all());

    $this->getJson('/api/v1/dashboard/products')->assertOk()
        ->assertJsonPath('meta.counts', ['all' => 7, 'active' => 6, 'inactive' => 1, 'out' => 2, 'low' => 3]);

    $first = $this->getJson('/api/v1/dashboard/products?sort=price_desc')->json('data.0');
    expect($first['id'])->toBe($plenty);

    $card = collect($this->getJson('/api/v1/dashboard/products')->json('data'))->keyBy('id');
    expect($card[$variantLow]['stock_total'])->toBe(20)
        ->and($card[$unlimited]['stock_total'])->toBeNull()
        ->and($card[$out]['categories'])->toBe([['id' => $shirts, 'name' => 'قمصان']]);

    $this->getJson('/api/v1/dashboard/products?status=bogus')->assertStatus(422)->assertJsonValidationErrors('status');
});

it('filters the list only by own categories', function () {
    $id = catalogCategory('ملابس');
    actingAsOwner();
    $this->getJson("/api/v1/dashboard/products?category_id={$id}")->assertStatus(422)->assertJsonValidationErrors('category_id');
});

// --- quick edit from the card ---------------------------------------------------------------

it('edits name, price, categories and stock from the card', function () {
    $a = catalogCategory('رجالي');
    $b = catalogCategory('عروض');
    $id = catalogProduct(['stock_mode' => 'product', 'stock' => 5]);

    $this->patchJson("/api/v1/dashboard/products/{$id}/quick", ['name' => 'قميص كتان', 'price' => '275.50', 'category_ids' => [$a, $b], 'primary_category_id' => $b, 'stock' => 12])
        ->assertOk()
        ->assertJsonPath('data.name', 'قميص كتان')
        ->assertJsonPath('data.price', 275.5)
        ->assertJsonPath('data.stock_total', 12)
        ->assertJsonPath('data.primary_category_id', $b)
        ->assertJsonPath('data.categories', [['id' => $a, 'name' => 'رجالي'], ['id' => $b, 'name' => 'عروض']]);
    // The movement log records the change (5 → 12).
    expect(asTenant($this->user, fn () => StockMovement::query()->where('product_id', $id)->sum('change')))->toEqual(7);

    // Unlimited ↔ tracked.
    $this->patchJson("/api/v1/dashboard/products/{$id}/quick", ['stock_mode' => 'unlimited'])->assertOk()->assertJsonPath('data.stock_total', null);
    $this->patchJson("/api/v1/dashboard/products/{$id}/quick", ['stock_mode' => 'product', 'stock' => 4])->assertOk()->assertJsonPath('data.stock_total', 4);
});

it('keeps stock per option combination out of the card', function () {
    $id = catalogVariant(['S' => 2, 'M' => 3]);

    $this->patchJson("/api/v1/dashboard/products/{$id}/quick", ['stock' => 10])->assertStatus(422)->assertJsonValidationErrors('stock');
    $this->patchJson("/api/v1/dashboard/products/{$id}/quick", ['stock_mode' => 'unlimited'])->assertStatus(422);
    $this->patchJson("/api/v1/dashboard/products/{$id}/quick", ['price' => 150])->assertOk()->assertJsonPath('data.stock_total', 5);
});

it('validates the card edit', function () {
    $id = catalogProduct();
    $this->patchJson("/api/v1/dashboard/products/{$id}/quick", ['name' => '', 'price' => 0, 'stock' => -1, 'stock_mode' => 'variant'])
        ->assertStatus(422)->assertJsonValidationErrors(['name', 'price', 'stock', 'stock_mode']);
});

it('isolates the card edit between stores', function () {
    $id = catalogProduct();
    $mine = catalogCategory('ملابس');
    actingAsOwner();
    $this->patchJson("/api/v1/dashboard/products/{$id}/quick", ['name' => 'x'])->assertNotFound();

    $other = catalogProduct();
    $this->patchJson("/api/v1/dashboard/products/{$other}/quick", ['category_ids' => [$mine]])->assertStatus(422)->assertJsonValidationErrors('category_ids.0');
});

// --- bulk -----------------------------------------------------------------------------------

it('applies one action to several products', function () {
    $cat = catalogCategory('عروض');
    $p1 = catalogProduct();
    $p2 = catalogProduct();
    $p3 = catalogProduct();

    $this->postJson('/api/v1/dashboard/products/bulk', ['action' => 'deactivate', 'ids' => [$p1, $p2]])->assertOk()->assertJsonPath('data.done', 2);
    $this->getJson('/api/v1/dashboard/products')->assertJsonPath('meta.counts.inactive', 2);

    $this->postJson('/api/v1/dashboard/products/bulk', ['action' => 'add_category', 'ids' => [$p1, $p3], 'category_id' => $cat])->assertOk();
    $this->getJson("/api/v1/dashboard/products/{$p1}")->assertJsonPath('data.category_ids', [$cat])->assertJsonPath('data.primary_category_id', $cat);

    $this->postJson('/api/v1/dashboard/products/bulk', ['action' => 'remove_category', 'ids' => [$p1], 'category_id' => $cat])->assertOk();
    $this->getJson("/api/v1/dashboard/products/{$p1}")->assertJsonPath('data.category_ids', [])->assertJsonPath('data.primary_category_id', null);

    $this->postJson('/api/v1/dashboard/products/bulk', ['action' => 'delete', 'ids' => [$p2, $p3]])->assertOk()->assertJsonPath('data.done', 2);
    $this->getJson('/api/v1/dashboard/products')->assertJsonPath('meta.total', 1);
});

it('validates bulk actions and keeps them inside the store', function () {
    $mine = catalogProduct();
    $this->postJson('/api/v1/dashboard/products/bulk', ['action' => 'explode', 'ids' => []])->assertStatus(422)->assertJsonValidationErrors(['action', 'ids']);
    $this->postJson('/api/v1/dashboard/products/bulk', ['action' => 'add_category', 'ids' => [$mine]])->assertStatus(422)->assertJsonValidationErrors('category_id');

    actingAsOwner();
    $this->postJson('/api/v1/dashboard/products/bulk', ['action' => 'delete', 'ids' => [$mine]])->assertStatus(422)->assertJsonValidationErrors('ids.0');
    expect(Product::query()->withoutGlobalScopes()->whereKey($mine)->exists())->toBeTrue();
});

it('needs a signed-in owner for the new product and category endpoints', function () {
    app('auth')->forgetGuards();
    $this->patchJson('/api/v1/dashboard/products/1/quick', [])->assertUnauthorized();
    $this->postJson('/api/v1/dashboard/products/bulk', [])->assertUnauthorized();
    $this->deleteJson('/api/v1/dashboard/categories/1?children=delete')->assertUnauthorized();
});

// --- SEO ----------------------------------------------------------------------------------

it('fills empty SEO fields from the product and keeps what the owner wrote', function () {
    asTenant($this->user, fn () => Identity::factory()->default()->create(['brand_name' => 'بيت القهوة']));
    $cat = catalogCategory('بن');

    $id = $this->postJson('/api/v1/dashboard/products', [
        'name' => 'بن برازيلي', 'price' => 180, 'category_ids' => [$cat], 'description' => "**محمص طازة**\n- 250 جرام",
        'seo' => ['keywords' => [' قهوة ', 'قهوة', '', 'بن مطحون']],
    ])->assertCreated()
        ->assertJsonPath('data.seo', ['keywords' => ['قهوة', 'بن مطحون']])
        ->assertJsonPath('data.seo_defaults.title', 'بن برازيلي | بيت القهوة')
        ->assertJsonPath('data.seo_defaults.description', 'محمص طازة 250 جرام')
        ->assertJsonPath('data.seo_defaults.keywords', ['بن برازيلي', 'بن', 'بيت القهوة'])
        ->json('data.id');

    // No text at all: a sentence with the price.
    $this->putJson("/api/v1/dashboard/products/{$id}", ['name' => 'بن برازيلي', 'price' => 180, 'description' => null])
        ->assertOk()->assertJsonPath('data.seo_defaults.description', __('store.seo_product_description', ['name' => 'بن برازيلي', 'price' => '180', 'store' => 'بيت القهوة']));

    // The owner's fields win; empty ones stay automatic.
    $merged = SeoDefaults::merge(['title' => 'عنواني', 'keywords' => []], ['title' => 'auto', 'description' => 'auto d', 'keywords' => ['k']]);
    expect($merged)->toBe(['title' => 'عنواني', 'keywords' => ['k'], 'description' => 'auto d']);
});

it('gives categories automatic SEO with their parents as keywords', function () {
    asTenant($this->user, fn () => Identity::factory()->default()->create(['brand_name' => 'سوق']));
    $root = catalogCategory('ملابس');
    $this->postJson('/api/v1/dashboard/categories', ['name' => 'رجالي', 'parent_id' => $root, 'seo' => ['keywords' => ['موضة']]])->assertCreated();

    $row = collect($this->getJson('/api/v1/dashboard/categories')->json('data'))->firstWhere('name', 'رجالي');
    expect($row['seo'])->toBe(['keywords' => ['موضة']])
        ->and($row['seo_defaults']['title'])->toBe('رجالي | سوق')
        ->and($row['seo_defaults']['keywords'])->toBe(['رجالي', 'ملابس', 'سوق']);
});

it('tells the dashboard the store name used by the automatic SEO', function () {
    asTenant($this->user, fn () => Identity::factory()->default()->create(['brand_name' => 'بيت القهوة']));
    $this->getJson('/api/v1/auth/me')->assertOk()->assertJsonPath('data.store_name', 'بيت القهوة');
});
