<?php

declare(strict_types=1);

use App\Jobs\RevalidateTenantHosts;
use App\Models\Customer;
use App\Models\Domain;
use App\Models\Identity;
use App\Models\Product;
use App\Models\ProductReview;
use App\Models\Tenant;
use App\Models\User;
use Database\Seeders\ThemeSeeder;
use Illuminate\Support\Facades\Queue;
use Laravel\Sanctum\Sanctum;

/*
 * Stage S2 (docs/plans/tekno/PLAN.md §2): spec filters and their counts on store lists, «قارن» and «المفضلة»
 * endpoints, and the product name of the home reviews.
 */

const SF_HOST = 'filters.localhost';

beforeEach(function () {
    Queue::fake();
    $this->seed(ThemeSeeder::class);
    $this->tenant = Tenant::factory()->onPlan('pro')->create();
    $this->owner = User::factory()->for($this->tenant)->create();
    Domain::factory()->for($this->tenant)->create(['host' => SF_HOST, 'active_host' => SF_HOST]);
    asTenant($this->tenant, fn () => Identity::factory()->default()->create());
    Sanctum::actingAs($this->owner->fresh(['tenant']));
    $this->postJson('/api/v1/dashboard/store/setup')->assertOk();
    $this->postJson('/api/v1/dashboard/store/design/publish')->assertOk();
    $this->putJson('/api/v1/dashboard/store', ['is_enabled' => true])->assertOk();
});

/** A laptop with its RAM / CPU rows (filterable) and a weight row (not a filter). */
function sfLaptop(string $name, string $ram, string $cpu, array $extra = []): int
{
    return test()->postJson('/api/v1/dashboard/products', ['name' => $name, 'price' => 20000, 'in_store' => true, 'specs' => [['name' => 'لابتوب', 'rows' => [
        ['label' => 'الرامات', 'value' => $ram, 'filterable' => true],
        ['label' => 'المعالج', 'value' => $cpu, 'filterable' => true, 'in_card' => true],
        ['label' => 'الوزن', 'value' => '1.4 كجم'],
    ]]], ...$extra])->assertCreated()->json('data.id');
}

/** @return array<string, mixed> */
function sfList(array $query = []): array
{
    return test()->getJson('/api/v1/public/store/products?'.http_build_query(['host' => SF_HOST, ...$query]), internalHeaders())->assertOk()->json();
}

/** @return list<string> */
function sfNames(array $query): array
{
    $names = array_column(sfList($query)['data'], 'name');
    sort($names);

    return $names;
}

it('filters lists by spec values: any value of a label, every label', function () {
    sfLaptop('أ', '16GB', 'Core i5');
    sfLaptop('ب', '8GB', 'Core i5');
    sfLaptop('ج', '16GB', 'Core i7');
    test()->postJson('/api/v1/dashboard/products', ['name' => 'ماوس', 'price' => 450, 'in_store' => true])->assertCreated();

    expect(sfNames(['spec' => json_encode(['الرامات' => ['16GB']])]))->toBe(['أ', 'ج'])
        ->and(sfNames(['spec' => json_encode(['الرامات' => ['16GB', '8GB']])]))->toBe(['أ', 'ب', 'ج'])
        ->and(sfNames(['spec' => json_encode(['الرامات' => ['16GB'], 'المعالج' => ['Core i5']])]))->toBe(['أ'])
        // Case does not matter; spaces around are dropped.
        ->and(sfNames(['spec' => json_encode(['الرامات' => [' 16gb ']])]))->toBe(['أ', 'ج'])
        // A row that is not a filter never filters.
        ->and(sfNames(['spec' => json_encode(['الوزن' => ['1.4 كجم']])]))->toBe([])
        // A broken link shows the whole list.
        ->and(sfList(['spec' => '{not json'])['data'])->toHaveCount(4);
});

it('counts the values of each filter for the list, its category included', function () {
    $laptops = $this->postJson('/api/v1/dashboard/categories', ['name' => 'لابتوبات', 'slug' => 'laptops'])->assertCreated()->json('data.id');
    $gaming = $this->postJson('/api/v1/dashboard/categories', ['name' => 'جيمنج', 'slug' => 'gaming', 'parent_id' => $laptops])->assertCreated()->json('data.id');
    sfLaptop('أ', '16GB', 'Core i5', ['category_ids' => [$laptops]]);
    sfLaptop('ب', '8GB', 'Core i5', ['category_ids' => [$gaming]]);
    sfLaptop('ج', '32GB', 'Core i7');
    // Hidden products never count.
    sfLaptop('مخفي', '64GB', 'Core i9', ['category_ids' => [$laptops], 'is_active' => false]);

    $facets = sfList(['category' => 'laptops'])['meta']['facets'];
    expect(array_column($facets, 'label'))->toBe(['الرامات', 'المعالج'])
        // Values in natural order (8 before 16).
        ->and($facets[0]['values'])->toBe([['value' => '8GB', 'count' => 1], ['value' => '16GB', 'count' => 1]])
        ->and($facets[1]['values'])->toBe([['value' => 'Core i5', 'count' => 2]]);

    $all = collect(sfList()['meta']['facets'])->keyBy('label');
    expect(array_column($all['الرامات']['values'], 'value'))->toBe(['8GB', '16GB', '32GB']);
    // The search narrows them too.
    expect(array_column(sfList(['q' => 'ج'])['meta']['facets'][0]['values'], 'value'))->toBe(['32GB']);
});

it('keeps the counts for a while and counts again when the store changes', function () {
    $a = sfLaptop('أ', '16GB', 'Core i5');
    expect(sfList()['meta']['facets'][0]['values'][0]['value'])->toBe('16GB');

    $this->putJson("/api/v1/dashboard/products/{$a}", ['name' => 'أ', 'price' => 20000, 'specs' => [['name' => 'لابتوب', 'rows' => [['label' => 'الرامات', 'value' => '32GB', 'filterable' => true]]]]])->assertOk();
    // Cached until the store's pages are refreshed…
    expect(sfList()['meta']['facets'][0]['values'][0]['value'])->toBe('16GB');

    // …which every product save asks for.
    Queue::assertPushed(RevalidateTenantHosts::class);
    app()->call([new RevalidateTenantHosts($this->tenant->id), 'handle']);
    expect(sfList()['meta']['facets'][0]['values'][0]['value'])->toBe('32GB');
});

it('compares up to 4 products with their rows side by side', function () {
    $a = sfLaptop('أ', '16GB', 'Core i5');
    $b = test()->postJson('/api/v1/dashboard/products', ['name' => 'ب', 'price' => 30000, 'in_store' => true, 'specs' => [
        ['name' => 'لابتوب', 'rows' => [['label' => 'المعالج', 'value' => 'Core i7'], ['label' => 'البطارية', 'value' => '9 ساعات'], ['label' => 'الرامات', 'value' => '']]],
    ]])->assertCreated()->json('data.id');
    $hidden = sfLaptop('مخفي', '8GB', 'Core i3', ['is_active' => false]);

    $data = $this->getJson('/api/v1/public/store/compare?'.http_build_query(['host' => SF_HOST, 'ids' => "{$b},{$a},{$hidden}"]), internalHeaders())->assertOk()->json('data');

    expect(array_column($data['products'], 'id'))->toBe([$b, $a])
        ->and($data['products'][0]['price'])->toEqual(30000)
        // The first product's rows first, then the labels only the next one has; empty values are blanks.
        ->and(array_column($data['rows'], 'label'))->toBe(['المعالج', 'البطارية', 'الرامات', 'الوزن'])
        ->and($data['rows'][0]['values'])->toBe([(string) $b => 'Core i7', (string) $a => 'Core i5'])
        ->and($data['rows'][2]['values'])->toBe([(string) $b => null, (string) $a => '16GB'])
        ->and($data['rows'][0]['group'])->toBe('لابتوب');

    foreach (['', '1,2,3,4,5', 'abc', '0'] as $bad) {
        $this->getJson('/api/v1/public/store/compare?'.http_build_query(['host' => SF_HOST, 'ids' => $bad]), internalHeaders())->assertStatus(422);
    }
});

it('returns cards by id for the wishlist, in order, without hidden or other stores products', function () {
    $a = sfLaptop('أ', '16GB', 'Core i5');
    $b = sfLaptop('ب', '8GB', 'Core i5');
    $hidden = sfLaptop('مخفي', '8GB', 'Core i3', ['is_active' => false]);
    $other = asTenant(createOwner(), fn () => Product::factory()->create(['in_store' => true])->id);

    $cards = $this->getJson('/api/v1/public/store/cards?'.http_build_query(['host' => SF_HOST, 'ids' => "{$b},{$hidden},{$other},{$a}"]), internalHeaders())->assertOk()->json('data');
    expect(array_column($cards, 'id'))->toBe([$b, $a])->and($cards[0]['spec_chips'])->toBe([['label' => 'المعالج', 'value' => 'Core i5']]);

    $this->getJson('/api/v1/public/store/cards?'.http_build_query(['host' => SF_HOST, 'ids' => 'x']), internalHeaders())->assertStatus(422);
    $this->getJson('/api/v1/public/store/cards?ids=1')->assertStatus(401);
});

it('names the product under each home review, linked only while on sale', function () {
    $watch = test()->postJson('/api/v1/dashboard/products', ['name' => 'ساعة ذكية', 'price' => 2599, 'in_store' => true, 'slug' => 'watch'])->assertCreated()->json('data.id');
    $off = test()->postJson('/api/v1/dashboard/products', ['name' => 'سماعة قديمة', 'price' => 900, 'in_store' => true, 'is_active' => false])->assertCreated()->json('data.id');
    asTenant($this->tenant, function () use ($watch, $off) {
        $c = Customer::query()->create(['phone' => '+201012345678', 'name' => 'سارة']);
        ProductReview::query()->create(['product_id' => $off, 'customer_id' => $c->id, 'rating' => 5, 'text' => 'كانت حلوة', 'author_name' => 'كريم', 'is_hidden' => false]);
        ProductReview::query()->create(['product_id' => $watch, 'customer_id' => $c->id, 'rating' => 5, 'text' => 'ممتازة', 'author_name' => 'سارة', 'is_hidden' => false]);
    });

    $reviews = $this->getJson('/api/v1/public/store?host='.SF_HOST, internalHeaders())->assertOk()->json('data.data.reviews');
    expect($reviews[0]['product'])->toBe(['name' => 'ساعة ذكية', 'slug' => 'watch'])
        ->and($reviews[1]['product'])->toBe(['name' => 'سماعة قديمة', 'slug' => null]);
});

it('keeps «compare» and «wishlist» for the store', function () {
    foreach (['compare', 'wishlist'] as $slug) {
        expect(in_array($slug, config('landing.reserved_slugs'), true))->toBeTrue();
    }
});
