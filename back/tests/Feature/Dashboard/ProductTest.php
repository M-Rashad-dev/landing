<?php

declare(strict_types=1);

use App\Http\Resources\PublicProductResource;
use App\Models\Media;
use App\Models\Product;
use App\Models\ProductOption;
use App\Models\ProductOptionValue;

function productPayload(array $overrides = []): array
{
    return array_merge([
        'name' => 'تيشيرت قطن',
        'description' => "**قطن مصري** 100%\n- مريح",
        'price' => '350',
        'compare_at_price' => '450.50',
        'sku' => 'TSH-01',
        'is_active' => true,
        'media_ids' => [],
        'options' => [
            [
                'name' => 'المقاس',
                'display_type' => 'buttons',
                'is_required' => true,
                'values' => [
                    ['label' => 'S'], ['label' => 'M'], ['label' => 'L'], ['label' => 'XL', 'price_delta' => '25'],
                ],
            ],
            [
                'name' => 'اللون',
                'display_type' => 'swatch',
                'is_required' => true,
                'values' => [
                    ['label' => 'أسود', 'color_hex' => '#000000'],
                    ['label' => 'أبيض', 'color_hex' => '#ffffff'],
                ],
            ],
        ],
    ], $overrides);
}

beforeEach(function () {
    $this->user = actingAsOwner();
});

it('creates a full product with options and ordered images', function () {
    $media = asTenant($this->user, fn () => Media::factory()->count(4)->create());
    $ids = $media->pluck('id')->reverse()->values()->all();

    $response = $this->postJson('/api/v1/dashboard/products', productPayload(['media_ids' => $ids]));

    $response->assertCreated()
        ->assertJsonPath('data.price', 350)
        ->assertJsonPath('data.compare_at_price', 450.5)
        ->assertJsonPath('data.discount_percent', 22)
        ->assertJsonPath('data.media_ids', $ids)
        ->assertJsonPath('data.main_image.id', $ids[0])
        ->assertJsonPath('data.options.0.name', 'المقاس')
        ->assertJsonPath('data.options.0.values.3.label', 'XL')
        ->assertJsonPath('data.options.0.values.3.price_delta', 25)
        ->assertJsonPath('data.options.1.values.1.color_hex', '#FFFFFF');

    $product = asTenant($this->user, fn () => Product::query()->firstOrFail());
    expect($product->price)->toBe('350.00');
});

it('updates nested options: edit, add, delete values and options', function () {
    $created = $this->postJson('/api/v1/dashboard/products', productPayload())->json('data');
    $size = $created['options'][0];

    $this->putJson("/api/v1/dashboard/products/{$created['id']}", productPayload([
        'options' => [[
            'id' => $size['id'],
            'name' => 'المقاس',
            'display_type' => 'dropdown',
            'values' => [
                ['id' => $size['values'][3]['id'], 'label' => 'XL', 'price_delta' => '30'],
                ['id' => $size['values'][0]['id'], 'label' => 'Small'],
                ['label' => 'XXL', 'price_delta' => '50'],
            ],
        ]],
    ]))->assertOk()
        ->assertJsonCount(1, 'data.options')
        ->assertJsonPath('data.options.0.id', $size['id'])
        ->assertJsonPath('data.options.0.display_type', 'dropdown')
        ->assertJsonPath('data.options.0.values.0.id', $size['values'][3]['id'])
        ->assertJsonPath('data.options.0.values.0.price_delta', 30)
        ->assertJsonPath('data.options.0.values.1.label', 'Small')
        ->assertJsonPath('data.options.0.values.2.label', 'XXL');

    asTenant($this->user, function () use ($size) {
        expect(ProductOption::query()->count())->toBe(1)
            ->and(ProductOptionValue::query()->count())->toBe(3)
            ->and(ProductOptionValue::query()->find($size['values'][1]['id']))->toBeNull();
    });
});

it('rejects an option id from another product', function () {
    $first = $this->postJson('/api/v1/dashboard/products', productPayload())->json('data');
    $second = $this->postJson('/api/v1/dashboard/products', productPayload(['name' => 'آخر']))->json('data');

    $this->putJson("/api/v1/dashboard/products/{$second['id']}", productPayload([
        'options' => [['id' => $first['options'][0]['id'], 'name' => 'المقاس', 'display_type' => 'buttons', 'values' => [['label' => 'S']]]],
    ]))->assertStatus(422)->assertJsonValidationErrors('options.0.id');
});

it('rejects a value id from another option', function () {
    $product = $this->postJson('/api/v1/dashboard/products', productPayload())->json('data');
    [$size, $color] = $product['options'];

    $this->putJson("/api/v1/dashboard/products/{$product['id']}", productPayload([
        'options' => [['id' => $size['id'], 'name' => 'المقاس', 'display_type' => 'buttons', 'values' => [['id' => $color['values'][0]['id'], 'label' => 'S']]]],
    ]))->assertStatus(422)->assertJsonValidationErrors('options.0.values.0.id');
});

it('validates prices', function (array $override, string $field) {
    $this->postJson('/api/v1/dashboard/products', productPayload($override))
        ->assertStatus(422)
        ->assertJsonValidationErrors($field);
})->with([
    'compare below price' => [['compare_at_price' => '300'], 'compare_at_price'],
    'compare equal price' => [['compare_at_price' => '350'], 'compare_at_price'],
    'zero price' => [['price' => '0'], 'price'],
    'too many decimals' => [['price' => '10.999'], 'price'],
    'too large' => [['price' => '10000000'], 'price'],
    'missing name' => [['name' => ''], 'name'],
]);

it('requires a color for swatch values', function () {
    $this->postJson('/api/v1/dashboard/products', productPayload([
        'options' => [['name' => 'اللون', 'display_type' => 'swatch', 'values' => [['label' => 'أحمر']]]],
    ]))->assertStatus(422)->assertJsonValidationErrors('options.0.values.0.color_hex');
});

it('ignores colors on non-swatch options', function () {
    $this->postJson('/api/v1/dashboard/products', productPayload([
        'options' => [['name' => 'المقاس', 'display_type' => 'buttons', 'values' => [['label' => 'S', 'color_hex' => '#FF0000']]]],
    ]))->assertCreated()->assertJsonPath('data.options.0.values.0.color_hex', null);
});

it('enforces option limits and uniqueness', function () {
    $option = fn (string $name) => ['name' => $name, 'display_type' => 'buttons', 'values' => [['label' => 'x']]];

    $this->postJson('/api/v1/dashboard/products', productPayload(['options' => array_map($option, ['a', 'b', 'c', 'd', 'e', 'f'])]))
        ->assertStatus(422)->assertJsonValidationErrors('options');

    $this->postJson('/api/v1/dashboard/products', productPayload(['options' => [$option('المقاس'), $option('المقاس')]]))
        ->assertStatus(422)->assertJsonValidationErrors('options.1.name');

    $this->postJson('/api/v1/dashboard/products', productPayload([
        'options' => [['name' => 'x', 'display_type' => 'buttons', 'values' => [['label' => 'S'], ['label' => 's']]]],
    ]))->assertStatus(422)->assertJsonValidationErrors('options.0.values.1.label');

    $this->postJson('/api/v1/dashboard/products', productPayload([
        'options' => [['name' => 'x', 'display_type' => 'buttons', 'values' => [['label' => 'S', 'price_delta' => '-5']]]],
    ]))->assertStatus(422)->assertJsonValidationErrors('options.0.values.0.price_delta');
});

it('rejects media of another tenant', function () {
    $foreign = Media::factory()->create();

    $this->postJson('/api/v1/dashboard/products', productPayload(['media_ids' => [$foreign->id]]))
        ->assertStatus(422)->assertJsonValidationErrors('media_ids.0');
});

it('lists with search, active filter and option counts', function () {
    $this->postJson('/api/v1/dashboard/products', productPayload())->assertCreated();
    $this->postJson('/api/v1/dashboard/products', productPayload(['name' => 'كوب', 'sku' => 'MUG-9', 'is_active' => false, 'options' => []]))->assertCreated();

    $this->getJson('/api/v1/dashboard/products')->assertJsonPath('meta.total', 2)->assertJsonPath('data.0.name', 'كوب');
    $this->getJson('/api/v1/dashboard/products?q=mug')->assertJsonCount(1, 'data');
    $this->getJson('/api/v1/dashboard/products?active=1')->assertJsonCount(1, 'data')->assertJsonPath('data.0.options_count', 2);
    $this->getJson('/api/v1/dashboard/products?active=0')->assertJsonPath('data.0.name', 'كوب');
});

it('toggles the active state', function () {
    $product = asTenant($this->user, fn () => Product::factory()->create());

    $this->postJson("/api/v1/dashboard/products/{$product->id}/toggle")->assertOk()->assertJsonPath('data.is_active', false);
    $this->postJson("/api/v1/dashboard/products/{$product->id}/toggle")->assertJsonPath('data.is_active', true);
});

it('duplicates with options and images as an inactive copy', function () {
    $media = asTenant($this->user, fn () => Media::factory()->count(2)->create());
    $original = $this->postJson('/api/v1/dashboard/products', productPayload(['media_ids' => $media->pluck('id')->all()]))->json('data');

    $copy = $this->postJson("/api/v1/dashboard/products/{$original['id']}/duplicate")->assertCreated()->json('data');

    expect($copy['name'])->toBe('تيشيرت قطن (نسخة)')
        ->and($copy['is_active'])->toBeFalse()
        ->and($copy['media_ids'])->toBe($original['media_ids'])
        ->and(count($copy['options']))->toBe(2)
        ->and($copy['options'][0]['id'])->not->toBe($original['options'][0]['id'])
        ->and(array_column($copy['options'][0]['values'], 'label'))->toBe(['S', 'M', 'L', 'XL']);
});

it('soft deletes a product', function () {
    $product = asTenant($this->user, fn () => Product::factory()->create());

    $this->deleteJson("/api/v1/dashboard/products/{$product->id}")->assertNoContent();
    $this->getJson("/api/v1/dashboard/products/{$product->id}")->assertNotFound();
    expect(Product::withTrashed()->withoutGlobalScopes()->find($product->id)?->trashed())->toBeTrue();
});

it('enforces the product limit', function () {
    config(['landing.limits.products' => 1]);
    $this->postJson('/api/v1/dashboard/products', productPayload())->assertCreated();

    $this->postJson('/api/v1/dashboard/products', productPayload())->assertStatus(403)->assertJsonPath('code', 'plan_limit_reached');
});

it('blocks deleting media used by a product', function () {
    $media = asTenant($this->user, fn () => Media::factory()->create());
    $this->postJson('/api/v1/dashboard/products', productPayload(['media_ids' => [$media->id]]))->assertCreated();

    $this->deleteJson("/api/v1/dashboard/media/{$media->id}")
        ->assertStatus(409)
        ->assertJsonPath('usages.0.type', 'product');
});

it('builds the public product without internal fields and inactive values', function () {
    $product = asTenant($this->user, fn () => Product::factory()
        ->withOption('المقاس', ['S' => '0', 'M' => '10'])
        ->withOption('فارغ', ['X' => '0'])
        ->create(['sku' => 'SECRET']));

    asTenant($this->user, function () use ($product) {
        ProductOptionValue::query()->where('label', 'M')->update(['is_active' => false]);
        ProductOptionValue::query()->where('label', 'X')->update(['is_active' => false]);

        $public = PublicProductResource::make($product->fresh(['options.values', 'media']))->resolve(request());

        expect($public)->not->toHaveKey('sku')
            ->and($public)->not->toHaveKey('created_at')
            ->and($public['available'])->toBeTrue()
            ->and($public['options'])->toHaveCount(1)
            ->and(array_column($public['options'][0]['values'], 'label'))->toBe(['S']);
    });
});
