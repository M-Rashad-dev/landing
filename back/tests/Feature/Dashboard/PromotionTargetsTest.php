<?php

declare(strict_types=1);

use App\Models\Category;
use App\Models\Product;

beforeEach(function () {
    $this->user = actingAsOwner();
    [$this->category, $this->product] = asTenant($this->user, function () {
        $category = Category::query()->create(['name' => 'ساعات', 'slug' => 'watches']);
        $product = Product::factory()->create(['price' => '100.00']);
        $product->categories()->attach($category->id);

        return [$category, $product];
    });
});

it('saves an offer on categories or on every product', function () {
    $this->postJson('/api/v1/dashboard/offers', ['name' => 'خصم الساعات', 'type' => 'percentage', 'value' => 15, 'applies_to' => 'categories', 'category_ids' => [$this->category->id]])
        ->assertCreated()
        ->assertJsonPath('data.applies_to', 'categories')
        ->assertJsonPath('data.category_ids', [$this->category->id])
        ->assertJsonPath('data.product_ids', []);

    $this->postJson('/api/v1/dashboard/offers', ['name' => 'كل المتجر', 'type' => 'percentage', 'value' => 5, 'applies_to' => 'all'])
        ->assertCreated()->assertJsonPath('data.applies_to', 'all');

    // Older clients sending only product_ids still mean "these products".
    $this->postJson('/api/v1/dashboard/offers', ['name' => 'قديم', 'type' => 'percentage', 'value' => 5, 'product_ids' => [$this->product->id]])
        ->assertCreated()->assertJsonPath('data.applies_to', 'products');
});

it('checks a fixed discount against the cheapest covered product', function () {
    $this->postJson('/api/v1/dashboard/offers', ['name' => 'x', 'type' => 'fixed', 'value' => 100, 'applies_to' => 'categories', 'category_ids' => [$this->category->id]])
        ->assertStatus(422)->assertJsonValidationErrors(['value']);
    $this->postJson('/api/v1/dashboard/offers', ['name' => 'x', 'type' => 'percentage', 'value' => 10, 'applies_to' => 'categories'])
        ->assertStatus(422)->assertJsonValidationErrors(['category_ids']);
});

it('saves a free-shipping code on a category, with pieces and first order', function () {
    $this->postJson('/api/v1/dashboard/discount-codes', [
        'code' => 'shipfree', 'type' => 'free_shipping', 'applies_to' => 'categories', 'category_ids' => [$this->category->id],
        'min_quantity' => 2, 'first_order_only' => true,
    ])->assertCreated()
        ->assertJsonPath('data.code', 'SHIPFREE')
        ->assertJsonPath('data.type', 'free_shipping')
        ->assertJsonPath('data.value', null)
        ->assertJsonPath('data.min_quantity', 2)
        ->assertJsonPath('data.first_order_only', true)
        ->assertJsonPath('data.categories.0.name', 'ساعات');

    $this->postJson('/api/v1/dashboard/discount-codes', ['code' => 'NOVAL', 'type' => 'fixed'])->assertStatus(422)->assertJsonValidationErrors(['value']);
    $this->postJson('/api/v1/dashboard/discount-codes', ['code' => 'X12', 'type' => 'percentage', 'value' => 10, 'min_quantity' => 0, 'applies_to' => 'everything'])
        ->assertStatus(422)->assertJsonValidationErrors(['min_quantity', 'applies_to']);
});

it('refuses another store’s categories', function () {
    actingAsOwner(createOwner());
    $this->postJson('/api/v1/dashboard/offers', ['name' => 'x', 'type' => 'percentage', 'value' => 10, 'applies_to' => 'categories', 'category_ids' => [$this->category->id]])
        ->assertStatus(422)->assertJsonValidationErrors(['category_ids.0']);
    $this->postJson('/api/v1/dashboard/discount-codes', ['code' => 'ABC', 'type' => 'percentage', 'value' => 10, 'applies_to' => 'categories', 'category_ids' => [$this->category->id]])
        ->assertStatus(422)->assertJsonValidationErrors(['category_ids.0']);
});
