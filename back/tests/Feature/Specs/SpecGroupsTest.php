<?php

declare(strict_types=1);

use App\Models\Product;
use App\Models\ProductSpecTable;
use App\Models\SpecGroup;
use Illuminate\Support\Facades\Queue;

/*
 * «مجموعات المواصفات» (docs/plans/tekno/PLAN.md §1): groups, adding a group to products, «ضيف التعديل», the fill
 * grid, limits, tenant isolation.
 */

function sgGroup(string $name = 'لابتوب', ?array $rows = null): array
{
    return test()->postJson('/api/v1/dashboard/spec-groups', [
        'name' => $name,
        'rows' => $rows ?? [
            ['label' => 'المعالج', 'in_card' => true, 'filterable' => true],
            ['label' => 'الرامات', 'in_card' => true],
            ['label' => 'التخزين'],
        ],
    ])->assertCreated()->json('data');
}

function sgProduct(array $data = []): int
{
    return test()->postJson('/api/v1/dashboard/products', ['name' => 'لابتوب 14', 'price' => 24999, ...$data])->assertCreated()->json('data.id');
}

/** @return list<array<string, mixed>> the product's spec tables as the product form shows them */
function sgSpecs(int $productId): array
{
    return test()->getJson("/api/v1/dashboard/products/{$productId}")->assertOk()->json('data.specs');
}

beforeEach(function () {
    Queue::fake();
    $this->user = actingAsOwner();
});

it('creates, lists, shows, updates and deletes a group', function () {
    $group = sgGroup();
    expect($group['rows'])->toHaveCount(3)
        ->and($group['rows'][0])->toBe(['label' => 'المعالج', 'in_card' => true, 'filterable' => true])
        ->and($group['rows'][2])->toBe(['label' => 'التخزين', 'in_card' => false, 'filterable' => false]);

    $product = sgProduct();
    $this->postJson("/api/v1/dashboard/spec-groups/{$group['id']}/apply", ['product_ids' => [$product]])->assertOk();

    $this->getJson('/api/v1/dashboard/spec-groups')->assertOk()
        ->assertJsonPath('data.0.name', 'لابتوب')
        ->assertJsonPath('data.0.rows_count', 3)
        ->assertJsonPath('data.0.products_count', 1)
        ->assertJsonPath('meta.max', 100);

    // Rows replaced in order.
    $this->putJson("/api/v1/dashboard/spec-groups/{$group['id']}", ['name' => 'لابتوبات', 'rows' => [['label' => 'الشاشة'], ['label' => 'المعالج', 'in_card' => true]]])
        ->assertOk()->assertJsonPath('data.name', 'لابتوبات')->assertJsonPath('data.rows.0.label', 'الشاشة')->assertJsonPath('data.rows.1.in_card', true);
    $this->getJson("/api/v1/dashboard/spec-groups/{$group['id']}")->assertOk()->assertJsonCount(2, 'data.rows');

    // The product kept its copy as it was.
    expect(array_column(sgSpecs($product)[0]['rows'], 'label'))->toBe(['المعالج', 'الرامات', 'التخزين']);

    $this->deleteJson("/api/v1/dashboard/spec-groups/{$group['id']}")->assertNoContent();
    $this->getJson('/api/v1/dashboard/spec-groups')->assertOk()->assertJsonCount(0, 'data');
});

it('keeps the products copies when a group is deleted', function () {
    $group = sgGroup();
    $product = sgProduct();
    $this->postJson("/api/v1/dashboard/spec-groups/{$group['id']}/apply", ['product_ids' => [$product]])->assertOk();

    $this->deleteJson("/api/v1/dashboard/spec-groups/{$group['id']}")->assertNoContent();

    $specs = sgSpecs($product);
    expect($specs)->toHaveCount(1)
        ->and($specs[0]['name'])->toBe('لابتوب')
        ->and($specs[0]['spec_group_id'])->toBeNull()
        ->and($specs[0]['rows'])->toHaveCount(3);
});

it('validates groups', function (array $body, string $error) {
    sgGroup('موجودة');
    $this->postJson('/api/v1/dashboard/spec-groups', $body)->assertStatus(422)->assertJsonValidationErrors($error);
})->with([
    'no name' => [['name' => '', 'rows' => [['label' => 'أ']]], 'name'],
    'long name' => [['name' => str_repeat('ا', 61), 'rows' => [['label' => 'أ']]], 'name'],
    'taken name' => [['name' => 'موجودة', 'rows' => [['label' => 'أ']]], 'name'],
    'no rows' => [['name' => 'جديدة', 'rows' => []], 'rows'],
    'empty label' => [['name' => 'جديدة', 'rows' => [['label' => ' ']]], 'rows.0.label'],
    'same label twice' => [['name' => 'جديدة', 'rows' => [['label' => 'اللون'], ['label' => ' اللون ']]], 'rows.1.label'],
    'five on the card' => [['name' => 'جديدة', 'rows' => array_map(fn ($i) => ['label' => "صف {$i}", 'in_card' => true], range(1, 5))], 'rows.4.in_card'],
    'too many rows' => [['name' => 'جديدة', 'rows' => array_map(fn ($i) => ['label' => "صف {$i}"], range(1, 41))], 'rows'],
]);

it('allows the same group name in another store', function () {
    sgGroup('لابتوب');
    actingAsOwner();
    sgGroup('لابتوب');
    expect(SpecGroup::query()->withoutGlobalScopes()->count())->toBe(2);
});

it('caps the groups of a store', function () {
    config(['landing.limits.spec_groups' => 2]);
    sgGroup('أ');
    sgGroup('ب');
    $this->postJson('/api/v1/dashboard/spec-groups', ['name' => 'ج', 'rows' => [['label' => 'س']]])
        ->assertStatus(422)->assertJsonPath('code', 'limit_reached');
});

it('adds a group to many products once, keeping the card limit', function () {
    $group = sgGroup();
    $a = sgProduct(['name' => 'أ']);
    // b already shows 3 rows on its card: only one more fits.
    $b = sgProduct(['name' => 'ب', 'specs' => [['name' => 'عام', 'rows' => [
        ['label' => 'س', 'value' => '1', 'in_card' => true], ['label' => 'ص', 'value' => '2', 'in_card' => true], ['label' => 'ع', 'value' => '3', 'in_card' => true],
    ]]]]);

    $this->postJson("/api/v1/dashboard/spec-groups/{$group['id']}/apply", ['product_ids' => [$a, $b]])
        ->assertOk()->assertJsonPath('data.added', 2)->assertJsonPath('data.skipped', 0);
    // Again: both have it already.
    $this->postJson("/api/v1/dashboard/spec-groups/{$group['id']}/apply", ['product_ids' => [$a, $b]])
        ->assertOk()->assertJsonPath('data.added', 0)->assertJsonPath('data.skipped', 2);

    $specsA = sgSpecs($a);
    expect($specsA[0]['spec_group_id'])->toBe($group['id'])
        ->and($specsA[0]['name'])->toBe('لابتوب')
        ->and(array_column($specsA[0]['rows'], 'in_card'))->toBe([true, true, false])
        ->and(array_column($specsA[0]['rows'], 'filterable'))->toBe([true, false, false])
        ->and(array_column($specsA[0]['rows'], 'value'))->toBe([null, null, null]);

    $specsB = sgSpecs($b);
    expect($specsB)->toHaveCount(2)->and(array_column($specsB[1]['rows'], 'in_card'))->toBe([true, false, false]);
});

it('skips products at their tables limit', function () {
    config(['landing.limits.spec_tables' => 1]);
    $group = sgGroup();
    $full = sgProduct(['specs' => [['name' => 'عام', 'rows' => [['label' => 'س']]]]]);
    $this->postJson("/api/v1/dashboard/spec-groups/{$group['id']}/apply", ['product_ids' => [$full]])
        ->assertOk()->assertJsonPath('data.added', 0)->assertJsonPath('data.skipped', 1);
});

it('validates the products to add the group to', function () {
    $group = sgGroup();
    $this->postJson("/api/v1/dashboard/spec-groups/{$group['id']}/apply", ['product_ids' => []])->assertStatus(422)->assertJsonValidationErrors('product_ids');
    $this->postJson("/api/v1/dashboard/spec-groups/{$group['id']}/apply", ['product_ids' => array_fill(0, 501, 1)])->assertStatus(422)->assertJsonValidationErrors('product_ids');

    $mine = $this->user;
    $other = actingAsOwner();
    $foreign = sgProduct();
    actingAsOwner($mine);
    $this->postJson("/api/v1/dashboard/spec-groups/{$group['id']}/apply", ['product_ids' => [$foreign]])->assertStatus(422)->assertJsonValidationErrors('product_ids.0');
    expect(asTenant($other, fn () => ProductSpecTable::query()->count()))->toBe(0);
});

it('pushes the group new rows to its products without touching their values', function () {
    $group = sgGroup();
    $a = sgProduct(['name' => 'أ']);
    $b = sgProduct(['name' => 'ب']);
    $this->postJson("/api/v1/dashboard/spec-groups/{$group['id']}/apply", ['product_ids' => [$a, $b]])->assertOk();

    // a: values filled, «التخزين» renamed «المساحة» and «الرامات» removed for this product only.
    $this->putJson("/api/v1/dashboard/products/{$a}", ['name' => 'أ', 'price' => 100, 'specs' => [[
        'spec_group_id' => $group['id'], 'name' => 'لابتوب', 'rows' => [
            ['label' => 'المعالج', 'value' => 'Core i5', 'in_card' => true],
            ['label' => 'المساحة', 'value' => '512GB'],
        ],
    ]]])->assertOk();

    $this->putJson("/api/v1/dashboard/spec-groups/{$group['id']}", ['name' => 'لابتوب', 'rows' => [
        ['label' => 'المعالج', 'in_card' => true], ['label' => 'الرامات', 'in_card' => true], ['label' => 'التخزين'], ['label' => 'الوزن', 'filterable' => true],
    ]])->assertOk();

    $this->postJson("/api/v1/dashboard/spec-groups/{$group['id']}/push")->assertOk()->assertJsonPath('data.updated', 2);

    $rowsA = sgSpecs($a)[0]['rows'];
    expect(array_column($rowsA, 'label'))->toBe(['المعالج', 'المساحة', 'الرامات', 'التخزين', 'الوزن'])
        ->and(array_column($rowsA, 'value'))->toBe(['Core i5', '512GB', null, null, null])
        ->and($rowsA[4]['filterable'])->toBeTrue();
    expect(array_column(sgSpecs($b)[0]['rows'], 'label'))->toBe(['المعالج', 'الرامات', 'التخزين', 'الوزن']);

    // Nothing new: nothing changes.
    $this->postJson("/api/v1/dashboard/spec-groups/{$group['id']}/push")->assertOk()->assertJsonPath('data.updated', 0);
});

it('fills values in the grid', function () {
    $group = sgGroup();
    $a = sgProduct(['name' => 'أ']);
    $b = sgProduct(['name' => 'ب']);
    $notUsing = sgProduct(['name' => 'ج']);
    $this->postJson("/api/v1/dashboard/spec-groups/{$group['id']}/apply", ['product_ids' => [$a, $b]])->assertOk();
    // a lost «التخزين»: the grid adds it back when a value is typed.
    $this->putJson("/api/v1/dashboard/products/{$a}", ['name' => 'أ', 'price' => 100, 'specs' => [[
        'spec_group_id' => $group['id'], 'name' => 'لابتوب', 'rows' => [['label' => 'المعالج'], ['label' => 'الرامات']],
    ]]])->assertOk();

    $grid = $this->getJson("/api/v1/dashboard/spec-groups/{$group['id']}/grid")->assertOk()
        ->assertJsonPath('meta.labels', ['المعالج', 'الرامات', 'التخزين'])
        ->assertJsonPath('meta.total', 2)
        ->json('data');
    expect(array_column($grid, 'product_id'))->toBe([$a, $b])
        ->and($grid[0]['values'])->toBe(['المعالج' => null, 'الرامات' => null, 'التخزين' => null]);

    $this->putJson("/api/v1/dashboard/spec-groups/{$group['id']}/grid", ['rows' => [
        ['product_id' => $a, 'values' => [['label' => 'المعالج', 'value' => ' Core i7 '], ['label' => 'التخزين', 'value' => '1TB']]],
        ['product_id' => $b, 'values' => [['label' => 'الرامات', 'value' => '16GB']]],
    ]])->assertOk()->assertJsonPath('data.updated', 2);

    $rowsA = sgSpecs($a)[0]['rows'];
    expect(array_column($rowsA, 'label'))->toBe(['المعالج', 'الرامات', 'التخزين'])
        ->and(array_column($rowsA, 'value'))->toBe(['Core i7', null, '1TB']);
    expect(array_column(sgSpecs($b)[0]['rows'], 'value'))->toBe([null, '16GB', null]);

    // Clearing a value.
    $this->putJson("/api/v1/dashboard/spec-groups/{$group['id']}/grid", ['rows' => [['product_id' => $a, 'values' => [['label' => 'المعالج', 'value' => '']]]]])
        ->assertOk()->assertJsonPath('data.updated', 1);
    expect(sgSpecs($a)[0]['rows'][0]['value'])->toBeNull();

    // A product without the group, a label not in it.
    $this->putJson("/api/v1/dashboard/spec-groups/{$group['id']}/grid", ['rows' => [['product_id' => $notUsing, 'values' => [['label' => 'المعالج', 'value' => 'x']]]]])
        ->assertStatus(422)->assertJsonValidationErrors('rows.0.product_id');
    $this->putJson("/api/v1/dashboard/spec-groups/{$group['id']}/grid", ['rows' => [['product_id' => $a, 'values' => [['label' => 'اللون', 'value' => 'x']]]]])
        ->assertStatus(422)->assertJsonValidationErrors('rows.0.values.0.label');
    $this->putJson("/api/v1/dashboard/spec-groups/{$group['id']}/grid", ['rows' => [['product_id' => $a, 'values' => [['label' => 'المعالج', 'value' => str_repeat('x', 201)]]]]])
        ->assertStatus(422)->assertJsonValidationErrors('rows.0.values.0.value');
    $this->putJson("/api/v1/dashboard/spec-groups/{$group['id']}/grid", ['rows' => array_fill(0, 201, ['product_id' => $a, 'values' => [['label' => 'المعالج', 'value' => 'x']]])])
        ->assertStatus(422)->assertJsonValidationErrors('rows');
});

it('ignores deleted products in the counts and the grid', function () {
    $group = sgGroup();
    $a = sgProduct();
    $this->postJson("/api/v1/dashboard/spec-groups/{$group['id']}/apply", ['product_ids' => [$a]])->assertOk();
    $this->deleteJson("/api/v1/dashboard/products/{$a}")->assertNoContent();

    $this->getJson('/api/v1/dashboard/spec-groups')->assertOk()->assertJsonPath('data.0.products_count', 0);
    $this->getJson("/api/v1/dashboard/spec-groups/{$group['id']}/grid")->assertOk()->assertJsonPath('meta.total', 0);
    expect(asTenant($this->user, fn () => Product::onlyTrashed()->count()))->toBe(1);
});

it('refuses guests', function () {
    $this->app['auth']->forgetGuards();
    $this->getJson('/api/v1/dashboard/spec-groups')->assertUnauthorized();
    $this->postJson('/api/v1/dashboard/spec-groups', ['name' => 'أ', 'rows' => [['label' => 'ب']]])->assertUnauthorized();
    $this->putJson('/api/v1/dashboard/spec-groups/1/grid', [])->assertUnauthorized();
});

it('hides other stores groups', function () {
    $group = sgGroup();
    actingAsOwner();
    $id = $group['id'];

    $this->getJson('/api/v1/dashboard/spec-groups')->assertOk()->assertJsonCount(0, 'data');
    $this->getJson("/api/v1/dashboard/spec-groups/{$id}")->assertNotFound();
    $this->putJson("/api/v1/dashboard/spec-groups/{$id}", ['name' => 'x', 'rows' => [['label' => 'y']]])->assertNotFound();
    $this->deleteJson("/api/v1/dashboard/spec-groups/{$id}")->assertNotFound();
    $this->postJson("/api/v1/dashboard/spec-groups/{$id}/apply", ['product_ids' => [sgProduct()]])->assertNotFound();
    $this->postJson("/api/v1/dashboard/spec-groups/{$id}/push")->assertNotFound();
    $this->getJson("/api/v1/dashboard/spec-groups/{$id}/grid")->assertNotFound();
    $this->putJson("/api/v1/dashboard/spec-groups/{$id}/grid", ['rows' => []])->assertNotFound();
    expect(SpecGroup::query()->withoutGlobalScopes()->whereKey($id)->exists())->toBeTrue();
});
