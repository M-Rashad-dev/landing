<?php

declare(strict_types=1);

use App\Models\Domain;
use App\Models\Identity;
use App\Models\Product;
use App\Models\ProductSpecRow;
use App\Models\Tenant;
use App\Models\User;
use Database\Seeders\ThemeSeeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;
use Laravel\Sanctum\Sanctum;

/*
 * «المواصفات» on a product (docs/plans/tekno/PLAN.md §1): the product form's tables, their limits, the public product
 * page, the cards' chips (no query per card), the copy on duplicate, and the product video link.
 */

const PS_HOST = 'specs.localhost';

beforeEach(function () {
    Queue::fake();
    $this->seed(ThemeSeeder::class);
    $this->tenant = Tenant::factory()->onPlan('pro')->create();
    $this->owner = User::factory()->for($this->tenant)->create();
    Domain::factory()->for($this->tenant)->create(['host' => PS_HOST, 'active_host' => PS_HOST]);
    asTenant($this->tenant, fn () => Identity::factory()->default()->create());
    Sanctum::actingAs($this->owner->fresh(['tenant']));
    $this->postJson('/api/v1/dashboard/store/setup')->assertOk();
    $this->postJson('/api/v1/dashboard/store/design/publish')->assertOk();
    $this->putJson('/api/v1/dashboard/store', ['is_enabled' => true])->assertOk();
});

/** @return list<array<string, mixed>> */
function psLaptopSpecs(): array
{
    return [
        ['name' => 'الأداء', 'rows' => [
            ['label' => 'المعالج', 'value' => 'Core i5-1335U', 'in_card' => true, 'filterable' => true],
            ['label' => 'الرامات', 'value' => '16GB DDR5', 'in_card' => true],
            ['label' => 'كارت الشاشة', 'value' => ''],
        ]],
        ['name' => 'في العلبة', 'rows' => [['label' => 'شاحن', 'value' => null]]],
        ['name' => 'الضمان', 'rows' => [['label' => 'المدة', 'value' => 'سنتين', 'in_card' => true]]],
    ];
}

function psProduct(array $data = []): array
{
    return test()->postJson('/api/v1/dashboard/products', ['name' => 'لابتوب 14', 'price' => 24999, 'in_store' => true, ...$data])->assertCreated()->json('data');
}

it('saves the spec tables of a product and replaces them on update', function () {
    $product = psProduct(['specs' => psLaptopSpecs()]);

    expect($product['specs'])->toHaveCount(3)
        ->and($product['specs'][0]['name'])->toBe('الأداء')
        ->and($product['specs'][0]['spec_group_id'])->toBeNull()
        ->and($product['specs'][0]['rows'][0])->toBe(['label' => 'المعالج', 'value' => 'Core i5-1335U', 'in_card' => true, 'filterable' => true])
        // Empty values are kept as empty rows.
        ->and($product['specs'][0]['rows'][2]['value'])->toBeNull();

    // A save without `specs` keeps them.
    $this->putJson("/api/v1/dashboard/products/{$product['id']}", ['name' => 'لابتوب 14', 'price' => 23999])->assertOk()->assertJsonCount(3, 'data.specs');

    // The whole list is replaced (order too).
    $this->putJson("/api/v1/dashboard/products/{$product['id']}", ['name' => 'لابتوب 14', 'price' => 23999, 'specs' => [
        ['name' => 'الضمان', 'rows' => [['label' => 'المدة', 'value' => 'سنة']]],
    ]])->assertOk()->assertJsonCount(1, 'data.specs')->assertJsonPath('data.specs.0.rows.0.value', 'سنة');
    expect(asTenant($this->tenant, fn () => ProductSpecRow::query()->count()))->toBe(1);

    $this->putJson("/api/v1/dashboard/products/{$product['id']}", ['name' => 'لابتوب 14', 'price' => 23999, 'specs' => []])->assertOk()->assertJsonCount(0, 'data.specs');
});

it('cleans the texts of the tables', function () {
    $product = psProduct(['specs' => [['name' => ' <b>الأداء</b> ', 'rows' => [['label' => ' المعالج ', 'value' => ' <i>Core i7</i> ']]]]]);
    expect($product['specs'][0]['name'])->toBe('الأداء')
        ->and($product['specs'][0]['rows'][0]['label'])->toBe('المعالج')
        ->and($product['specs'][0]['rows'][0]['value'])->toBe('Core i7');
});

it('validates the spec tables', function (Closure $specs, string $error) {
    $this->postJson('/api/v1/dashboard/products', ['name' => 'x', 'price' => 10, 'specs' => $specs()])
        ->assertStatus(422)->assertJsonValidationErrors($error);
})->with([
    'no name' => [fn () => [['name' => '', 'rows' => [['label' => 'أ']]]], 'specs.0.name'],
    'no rows' => [fn () => [['name' => 'أ', 'rows' => []]], 'specs.0.rows'],
    'empty label' => [fn () => [['name' => 'أ', 'rows' => [['label' => '']]]], 'specs.0.rows.0.label'],
    'long value' => [fn () => [['name' => 'أ', 'rows' => [['label' => 'ب', 'value' => str_repeat('x', 201)]]]], 'specs.0.rows.0.value'],
    'same table twice' => [fn () => [['name' => 'أ', 'rows' => [['label' => 'ب']]], ['name' => ' أ ', 'rows' => [['label' => 'ب']]]], 'specs.1.name'],
    'same label twice' => [fn () => [['name' => 'أ', 'rows' => [['label' => 'ب'], ['label' => 'ب']]]], 'specs.0.rows.1.label'],
    // The fifth card row is refused, never dropped.
    'five on the card' => [fn () => [
        ['name' => 'أ', 'rows' => [['label' => '1', 'in_card' => true], ['label' => '2', 'in_card' => true], ['label' => '3', 'in_card' => true]]],
        ['name' => 'ب', 'rows' => [['label' => '4', 'in_card' => true], ['label' => '5', 'in_card' => true]]],
    ], 'specs.1.rows.1.in_card'],
    'seven tables' => [fn () => array_map(fn ($i) => ['name' => "جدول {$i}", 'rows' => [['label' => 'ب']]], range(1, 7)), 'specs'],
    'forty-one rows' => [fn () => [['name' => 'أ', 'rows' => array_map(fn ($i) => ['label' => "صف {$i}"], range(1, 41))]], 'specs.0.rows'],
    'unknown group' => [fn () => [['name' => 'أ', 'spec_group_id' => 999999, 'rows' => [['label' => 'ب']]]], 'specs.0.spec_group_id'],
]);

it('refuses a group twice and a group of another store', function () {
    $group = $this->postJson('/api/v1/dashboard/spec-groups', ['name' => 'لابتوب', 'rows' => [['label' => 'المعالج']]])->assertCreated()->json('data.id');
    $this->postJson('/api/v1/dashboard/products', ['name' => 'x', 'price' => 10, 'specs' => [
        ['name' => 'أ', 'spec_group_id' => $group, 'rows' => [['label' => 'ب']]],
        ['name' => 'ب', 'spec_group_id' => $group, 'rows' => [['label' => 'ب']]],
    ]])->assertStatus(422)->assertJsonValidationErrors('specs.1.spec_group_id');

    actingAsOwner();
    $this->postJson('/api/v1/dashboard/products', ['name' => 'x', 'price' => 10, 'specs' => [['name' => 'أ', 'spec_group_id' => $group, 'rows' => [['label' => 'ب']]]]])
        ->assertStatus(422)->assertJsonValidationErrors('specs.0.spec_group_id');
});

it('shows the filled specs on the public product page only', function () {
    $product = psProduct(['specs' => psLaptopSpecs()]);
    $plain = psProduct(['name' => 'ماوس']);

    $specs = $this->getJson('/api/v1/public/store/products/'.$product['slug'].'?host='.PS_HOST, internalHeaders())->assertOk()->json('data.product.specs');
    // «في العلبة» has no value: dropped; «كارت الشاشة» is empty: dropped.
    expect($specs)->toBe([
        ['name' => 'الأداء', 'rows' => [
            ['label' => 'المعالج', 'value' => 'Core i5-1335U', 'in_card' => true],
            ['label' => 'الرامات', 'value' => '16GB DDR5', 'in_card' => true],
        ]],
        ['name' => 'الضمان', 'rows' => [['label' => 'المدة', 'value' => 'سنتين', 'in_card' => true]]],
    ]);
    $this->getJson('/api/v1/public/store/products/'.$plain['slug'].'?host='.PS_HOST, internalHeaders())->assertOk()->assertJsonPath('data.product.specs', []);
});

it('puts the card rows on the product cards', function () {
    psProduct(['specs' => psLaptopSpecs()]);
    psProduct(['name' => 'ماوس']);

    $cards = collect($this->getJson('/api/v1/public/store/products?host='.PS_HOST, internalHeaders())->assertOk()->json('data'))->keyBy('name');
    expect($cards['لابتوب 14']['spec_chips'])->toBe(['Core i5-1335U', '16GB DDR5', 'سنتين'])
        ->and($cards['ماوس']['spec_chips'])->toBe([]);
});

it('loads the card chips in one query for the whole page', function () {
    $count = function (): int {
        DB::flushQueryLog();
        DB::enableQueryLog();
        $this->getJson('/api/v1/public/store/products?host='.PS_HOST, internalHeaders())->assertOk();
        $n = count(DB::getQueryLog());
        DB::disableQueryLog();

        return $n;
    };
    psProduct(['name' => 'أول', 'specs' => psLaptopSpecs()]);
    // The first request also looks the host up (cached after it).
    $count();
    $few = $count();
    foreach (range(1, 10) as $i) {
        psProduct(['name' => "منتج {$i}", 'specs' => psLaptopSpecs()]);
    }

    expect($count())->toBe($few);
});

it('copies the specs with a duplicated product', function () {
    $product = psProduct(['specs' => psLaptopSpecs()]);
    $copy = $this->postJson("/api/v1/dashboard/products/{$product['id']}/duplicate")->assertCreated()->json('data');

    expect($copy['specs'])->toHaveCount(3)
        ->and($copy['specs'][0]['rows'][0]['value'])->toBe('Core i5-1335U')
        ->and($copy['specs'][0]['id'])->not->toBe($product['specs'][0]['id']);
});

it('keeps a product video link from YouTube or Vimeo', function () {
    $product = psProduct(['video_url' => 'https://www.youtube.com/watch?v=dQw4w9WgXcQ']);
    expect($product['video_url'])->toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    $this->getJson('/api/v1/public/store/products/'.$product['slug'].'?host='.PS_HOST, internalHeaders())->assertOk()
        ->assertJsonPath('data.product.video_url', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ');

    $this->putJson("/api/v1/dashboard/products/{$product['id']}", ['name' => 'لابتوب 14', 'price' => 24999, 'video_url' => ''])->assertOk()->assertJsonPath('data.video_url', null);

    foreach (['https://example.com/v.mp4', 'http://youtube.com/watch?v=x', 'javascript:alert(1)'] as $bad) {
        $this->putJson("/api/v1/dashboard/products/{$product['id']}", ['name' => 'لابتوب 14', 'price' => 24999, 'video_url' => $bad])
            ->assertStatus(422)->assertJsonValidationErrors('video_url');
    }
});

it('refuses guests and hides other stores products', function () {
    $product = psProduct(['specs' => psLaptopSpecs()]);

    actingAsOwner();
    $this->getJson("/api/v1/dashboard/products/{$product['id']}")->assertNotFound();
    $this->putJson("/api/v1/dashboard/products/{$product['id']}", ['name' => 'x', 'price' => 1, 'specs' => []])->assertNotFound();
    expect(asTenant($this->tenant, fn () => Product::query()->findOrFail($product['id'])->specTables()->count()))->toBe(3);

    app('auth')->forgetGuards();
    $this->putJson("/api/v1/dashboard/products/{$product['id']}", ['name' => 'x', 'price' => 1, 'specs' => []])->assertUnauthorized();
});
