<?php

declare(strict_types=1);

use App\Billing\SubscriptionManager;
use App\Enums\OrderStatus;
use App\Models\AbandonedLead;
use App\Models\Category;
use App\Models\DiscountCode;
use App\Models\Domain;
use App\Models\Identity;
use App\Models\LandingPage;
use App\Models\Offer;
use App\Models\Order;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\StockMovement;
use App\Models\Store;
use App\Models\StorePage;
use App\Models\Tenant;
use App\Models\User;
use App\Services\FormToken;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;

const STORE_HOST = 'souq.localhost';

function storeOwner(string $plan = 'pro'): User
{
    $tenant = Tenant::factory()->onPlan($plan)->create();
    $user = User::factory()->for($tenant)->create();
    Domain::factory()->for($tenant)->create(['host' => STORE_HOST, 'active_host' => STORE_HOST]);
    asTenant($tenant, fn () => Identity::factory()->default()->create());
    Sanctum::actingAs($user->fresh(['tenant']));

    return $user;
}

function storeSection(string $type, array $props = []): array
{
    return ['id' => (string) Str::uuid(), 'type' => $type, 'variant' => 'grid', 'visible' => true, 'props' => $props];
}

/** Sets up a live store (enabled, home published) through the API. */
function liveStore(): Store
{
    test()->postJson('/api/v1/dashboard/store/setup', ['content' => ['version' => 1, 'sections' => [storeSection('product_grid', ['source' => 'newest', 'limit' => 4])]]])->assertOk();
    $home = test()->getJson('/api/v1/dashboard/store')->json('data.home.id');
    test()->postJson("/api/v1/dashboard/pages/{$home}/publish")->assertOk();
    test()->putJson('/api/v1/dashboard/store', ['is_enabled' => true])->assertOk()->assertJsonPath('data.live', true);

    return Store::query()->withoutGlobalScopes()->latest('id')->firstOrFail();
}

function storePublic(string $path, array $query = [])
{
    return test()->getJson('/api/v1/public/'.$path.'?'.http_build_query(['host' => STORE_HOST] + $query), internalHeaders());
}

function storePost(string $path, array $body)
{
    return test()->postJson('/api/v1/public/'.$path, ['host' => STORE_HOST] + $body, internalHeaders());
}

function checkout(Store $store, array $items, array $extra = [])
{
    return storePost('store/orders', array_merge([
        'items' => $items,
        'customer' => ['name' => 'سارة محمد', 'phone' => '01012345678', 'governorate' => 'القاهرة', 'address' => 'شارع 9'],
        'form_token' => app(FormToken::class)->issue((int) $store->home_page_id, time() - 10),
    ], $extra));
}

// --- dashboard: store, categories, pages ------------------------------------------------

it('keeps the store to plans with the store feature', function () {
    storeOwner('basic');

    $this->postJson('/api/v1/dashboard/store/setup')->assertForbidden()->assertJsonPath('feature', 'store');
    $this->postJson('/api/v1/dashboard/categories', ['name' => 'رجالي'])->assertForbidden();
    $this->getJson('/api/v1/dashboard/store')->assertOk()->assertJsonPath('data.exists', false);
});

it('creates the store with its home page in the builder, kept out of the landing pages', function () {
    storeOwner();

    $this->postJson('/api/v1/dashboard/store/setup', ['content' => ['version' => 1, 'sections' => [storeSection('category_grid'), storeSection('hero')]]])
        ->assertOk()->assertJsonPath('data.theme_key', 'rewaq')->assertJsonPath('data.home.status', 'draft')->assertJsonPath('data.live', false);

    $home = LandingPage::query()->withoutGlobalScopes()->where('kind', 'store_home')->firstOrFail();
    expect($home->draft_content['sections'])->toHaveCount(2);
    $this->getJson('/api/v1/dashboard/pages')->assertJsonCount(0, 'data');
    $this->postJson("/api/v1/dashboard/pages/{$home->id}/duplicate")->assertStatus(422)->assertJsonPath('code', 'store_home');
    $this->deleteJson("/api/v1/dashboard/pages/{$home->id}")->assertStatus(422);

    // Store sections only on the store home; product sections refused there.
    $this->putJson("/api/v1/dashboard/pages/{$home->id}/content", ['version' => 1, 'content' => ['version' => 1, 'sections' => [storeSection('order_form')]]])
        ->assertStatus(422);
    $this->putJson("/api/v1/dashboard/pages/{$home->id}/content", ['version' => 1, 'content' => ['version' => 1, 'sections' => [storeSection('product_grid')]], 'theme_key' => 'malak'])
        ->assertStatus(422)->assertJsonValidationErrors('theme_key');
});

it('validates store settings and menus', function () {
    storeOwner();
    $this->postJson('/api/v1/dashboard/store/setup')->assertOk();

    $this->putJson('/api/v1/dashboard/store', ['settings' => ['products_per_page' => 500], 'menus' => ['header' => [['type' => 'url', 'label' => 'x', 'url' => 'javascript:alert(1)']], 'footer' => []]])
        ->assertStatus(422)->assertJsonValidationErrors(['settings.products_per_page', 'menus.header.0.url']);
    $this->putJson('/api/v1/dashboard/store', ['theme_key' => 'malak'])->assertStatus(422);
    $this->putJson('/api/v1/dashboard/store', ['settings' => ['announcement' => '<b>شحن مجاني</b>'], 'menus' => ['header' => [['type' => 'all_products', 'label' => 'كل المنتجات']], 'footer' => []]])
        ->assertOk()->assertJsonPath('data.settings.announcement', 'شحن مجاني')->assertJsonPath('data.menus.header.0.type', 'all_products');
});

it('keeps categories a tree without cycles and within the depth', function () {
    storeOwner();
    $a = $this->postJson('/api/v1/dashboard/categories', ['name' => 'ملابس'])->assertCreated()->assertJsonPath('data.slug', 'ملابس')->json('data.id');
    $b = $this->postJson('/api/v1/dashboard/categories', ['name' => 'رجالي', 'parent_id' => $a])->assertCreated()->assertJsonPath('data.depth', 1)->json('data.id');
    $c = $this->postJson('/api/v1/dashboard/categories', ['name' => 'قمصان', 'parent_id' => $b])->assertCreated()->assertJsonPath('data.depth', 2)->json('data.id');

    $this->putJson("/api/v1/dashboard/categories/{$a}", ['parent_id' => $c])->assertStatus(422)->assertJsonValidationErrors('parent_id');
    config(['landing.limits.category_depth' => 3]);
    $this->postJson('/api/v1/dashboard/categories', ['name' => 'أكمام', 'parent_id' => $c])->assertStatus(422)->assertJsonValidationErrors('parent_id');

    // Deleting the middle one moves its child up.
    $this->deleteJson("/api/v1/dashboard/categories/{$b}")->assertNoContent();
    expect(Category::query()->withoutGlobalScopes()->find($c))->parent_id->toBe($a)->depth->toBe(1);
    $this->getJson('/api/v1/dashboard/categories')->assertOk()->assertJsonCount(2, 'data');
});

it('isolates categories and store pages between stores', function () {
    storeOwner();
    $id = $this->postJson('/api/v1/dashboard/categories', ['name' => 'ملابس'])->json('data.id');
    $page = $this->postJson('/api/v1/dashboard/store-pages', ['title' => 'من نحن', 'body' => '# أهلًا'])->assertCreated()->assertJsonPath('data.slug', 'من-نحن')->json('data.id');

    $tenant = Tenant::factory()->create();
    Sanctum::actingAs(User::factory()->for($tenant)->create()->fresh(['tenant']));
    $this->putJson("/api/v1/dashboard/categories/{$id}", ['name' => 'x'])->assertNotFound();
    $this->deleteJson("/api/v1/dashboard/store-pages/{$page}")->assertNotFound();
    $this->postJson('/api/v1/dashboard/categories', ['name' => 'x', 'parent_id' => $id])->assertStatus(422)->assertJsonValidationErrors('parent_id');
    $this->getJson('/api/v1/dashboard/categories')->assertJsonCount(0, 'data');
});

it('saves products with store fields, categories, negative option prices and variant stock', function () {
    storeOwner();
    $cat = $this->postJson('/api/v1/dashboard/categories', ['name' => 'تيشيرتات'])->json('data.id');

    $id = $this->postJson('/api/v1/dashboard/products', [
        'name' => 'تيشيرت قطن', 'price' => 300, 'short_description' => 'قطن 100%', 'category_ids' => [$cat], 'is_featured' => true,
        'seo' => ['title' => 'تيشيرت'], 'stock_mode' => 'variant',
        'options' => [
            ['name' => 'المقاس', 'display_type' => 'buttons', 'is_required' => true, 'values' => [['label' => 'S', 'price_delta' => -20], ['label' => 'XL', 'price_delta' => 50]]],
        ],
        'variants' => [['values' => ['المقاس' => 'S'], 'stock' => 3], ['values' => ['المقاس' => 'XL'], 'stock' => 0], ['values' => ['المقاس' => 'XXL'], 'stock' => 9]],
    ])->assertCreated()
        ->assertJsonPath('data.slug', 'تيشيرت-قطن')
        ->assertJsonPath('data.category_ids', [$cat])
        ->assertJsonPath('data.options.0.values.0.price_delta', -20)
        ->assertJsonCount(2, 'data.variants')
        ->json('data.id');

    expect(asTenant(auth()->user(), fn () => StockMovement::query()->where('product_id', $id)->sum('change')))->toEqual(3);
    $this->postJson("/api/v1/dashboard/products/{$id}/duplicate")->assertCreated()->assertJsonPath('data.slug', fn ($s) => $s !== 'تيشيرت-قطن');
});

// --- public store --------------------------------------------------------------------------

it('serves a live store: config, catalog filters, product page, pages; not before it is live', function () {
    $owner = storeOwner();
    storePublic('store')->assertNotFound()->assertJsonPath('code', 'store_not_live');

    asTenant($owner, function () {
        $shirts = Category::query()->create(['name' => 'قمصان', 'slug' => 'shirts', 'depth' => 0]);
        $red = Product::factory()->create(['name' => 'قميص أحمر', 'slug' => 'red', 'price' => '200.00', 'stock_mode' => 'product', 'stock' => 0]);
        $blue = Product::factory()->create(['name' => 'قميص أزرق', 'slug' => 'blue', 'price' => '400.00', 'is_featured' => true]);
        $hidden = Product::factory()->create(['name' => 'خفي', 'slug' => 'hidden', 'in_store' => false]);
        $red->categories()->attach($shirts);
        $blue->categories()->attach($shirts);
        StorePage::query()->create(['title' => 'سياسة الاسترجاع', 'slug' => 'returns', 'body' => 'خلال 14 يوم']);

        return [$shirts, $red, $blue, $hidden];
    });
    liveStore();

    storePublic('resolve-host')->assertJsonPath('data.store_live', true);
    storePublic('store')->assertOk()->assertJsonPath('data.theme_key', 'rewaq')->assertJsonPath('data.categories.0.slug', 'shirts')
        ->assertJsonPath('data.categories.0.products_count', 2)->assertJsonCount(2, 'data.home.data.products.'.asTenant($owner, fn () => Store::query()->first()->homePage->published_content['sections'][0]['id']));
    storePublic('store/products')->assertJsonCount(2, 'data')->assertJsonPath('meta.total', 2);
    storePublic('store/products', ['category' => 'shirts', 'sort' => 'price_asc'])->assertJsonPath('data.0.slug', 'red')->assertJsonPath('data.0.available', false);
    storePublic('store/products', ['in_stock' => 1])->assertJsonCount(1, 'data')->assertJsonPath('data.0.slug', 'blue');
    storePublic('store/products', ['q' => 'أزرق'])->assertJsonCount(1, 'data');
    storePublic('store/products', ['min' => 300])->assertJsonCount(1, 'data');
    storePublic('store/products/blue')->assertOk()->assertJsonPath('data.product.name', 'قميص أزرق')->assertJsonPath('data.breadcrumb.0.slug', 'shirts')->assertJsonPath('data.related.0.slug', 'red');
    storePublic('store/products/hidden')->assertNotFound();
    storePublic('store/pages/returns')->assertOk()->assertJsonPath('data.body', 'خلال 14 يوم');
    storePublic('sitemap')->assertOk()->assertJsonFragment(['slug' => 'products/blue'])->assertJsonFragment(['slug' => 'categories/shirts']);
});

it('stops serving the store when the plan loses the store feature', function () {
    $owner = storeOwner();
    liveStore();
    app(SubscriptionManager::class)->grant($owner->tenant, 'basic', 30, null, null);

    storePublic('store')->assertNotFound();
    storePublic('resolve-host')->assertJsonPath('data.store_live', false);
});

it('prices a cart: options, offers per product, a code on eligible lines, shipping', function () {
    $owner = storeOwner();
    [$a, $b] = asTenant($owner, function () {
        $a = Product::factory()->withOption('المقاس', ['M' => '0', 'XL' => '50'])->create(['slug' => 'a', 'price' => '100.00']);
        $b = Product::factory()->create(['slug' => 'b', 'price' => '200.00']);
        Offer::factory()->create(['type' => 'percentage', 'value' => 10, 'is_active' => true])->products()->attach($b, ['tenant_id' => $b->tenant_id]);
        DiscountCode::factory()->create(['code' => 'A20', 'type' => 'fixed', 'value' => 20, 'stackable_with_offers' => true])->products()->attach($a, ['tenant_id' => $a->tenant_id]);

        return [$a, $b];
    });
    liveStore();
    [$option, $xl] = asTenant($owner, fn () => [$a->options()->value('id'), $a->options()->first()->values()->where('label', 'XL')->value('id')]);

    storePost('store/quote', ['items' => [['product_id' => $a->id, 'quantity' => 2, 'options' => [$option => $xl]], ['product_id' => $b->id, 'quantity' => 1]], 'code' => 'a20'])
        ->assertOk()
        ->assertJsonPath('data.subtotal', 500)          // 2 × 150 + 200
        ->assertJsonPath('data.offer_discount', 20)     // 10% of b
        ->assertJsonPath('data.code_discount', 20)      // fixed 20 on a's lines
        ->assertJsonPath('data.total', 460)
        ->assertJsonPath('data.lines.1.offer.name', fn ($n) => $n !== null);
    storePost('store/quote', ['items' => [['product_id' => $a->id, 'quantity' => 1]]])->assertStatus(422)->assertJsonValidationErrors("items.0.options.{$option}");
    storePost('store/quote', ['items' => [['product_id' => 999999, 'quantity' => 1]]])->assertStatus(422)->assertJsonValidationErrors('items.0.product_id');
});

it('places a store order with several lines and takes the stock, given back on cancel', function () {
    $owner = storeOwner();
    [$a, $b] = asTenant($owner, function () {
        $a = Product::factory()->create(['slug' => 'a', 'price' => '100.00', 'stock_mode' => 'product', 'stock' => 3]);
        $b = Product::factory()->withOption('المقاس', ['M' => '0', 'L' => '0'])->create(['slug' => 'b', 'price' => '50.00', 'stock_mode' => 'variant']);
        $m = $b->options()->first()->values()->where('label', 'M')->value('id');
        ProductVariant::query()->create(['product_id' => $b->id, 'combination_key' => (string) $m, 'stock' => 1]);

        return [$a, $b];
    });
    $store = liveStore();
    [$option, $m] = asTenant($owner, fn () => [$b->options()->value('id'), $b->options()->first()->values()->where('label', 'M')->value('id')]);

    // More than left: refused on the line.
    checkout($store, [['product_id' => $a->id, 'quantity' => 4]])->assertStatus(422)->assertJsonValidationErrors('items.0.quantity');

    $number = checkout($store, [['product_id' => $a->id, 'quantity' => 2], ['product_id' => $b->id, 'quantity' => 1, 'options' => [$option => $m]]])
        ->assertCreated()->assertJsonPath('data.total', 250)->json('data.order_number');

    $order = Order::query()->withoutGlobalScopes()->where('order_number', $number)->firstOrFail();
    expect($order->source)->toBe('store')->and(asTenant($owner, fn () => $order->items()->count()))->toBe(2)->and($order->quantity)->toBe(3)
        ->and(asTenant($owner, fn () => $a->fresh()->stock))->toBe(1)
        ->and(ProductVariant::query()->withoutGlobalScopes()->value('stock'))->toBe(0);

    // The last M is gone.
    checkout($store, [['product_id' => $b->id, 'quantity' => 1, 'options' => [$option => $m]]], ['customer' => ['name' => 'x y', 'phone' => '01112345678', 'governorate' => 'القاهرة', 'address' => 'x']])
        ->assertStatus(422)->assertJsonValidationErrors('items.0.quantity');

    $this->postJson("/api/v1/dashboard/orders/{$order->id}/status", ['status' => OrderStatus::Cancelled->value])->assertOk();
    expect(asTenant($owner, fn () => $a->fresh()->stock))->toBe(3)->and(ProductVariant::query()->withoutGlobalScopes()->value('stock'))->toBe(1);
    // Restocked once only.
    $this->getJson("/api/v1/dashboard/orders/{$order->id}")->assertOk()->assertJsonPath('data.source', 'store')->assertJsonCount(2, 'data.items');
});

it('rejects bots and bad tokens on checkout', function () {
    $owner = storeOwner();
    $product = asTenant($owner, fn () => Product::factory()->create(['slug' => 'p']));
    $store = liveStore();

    checkout($store, [['product_id' => $product->id, 'quantity' => 1]], ['website' => 'spam'])->assertStatus(422)->assertJsonPath('code', 'rejected');
    checkout($store, [['product_id' => $product->id, 'quantity' => 1]], ['form_token' => 'bad'])->assertStatus(422)->assertJsonPath('code', 'rejected');
});

it('records abandoned checkouts and store traffic', function () {
    $owner = storeOwner();
    $product = asTenant($owner, fn () => Product::factory()->create(['slug' => 'p', 'price' => '100.00']));
    $store = liveStore();

    storePost('store/leads', ['items' => [['product_id' => $product->id, 'quantity' => 2]], 'phone' => '01012345678', 'form_token' => app(FormToken::class)->issue((int) $store->home_page_id, time() - 10)])->assertStatus(202);
    $lead = AbandonedLead::query()->withoutGlobalScopes()->firstOrFail();
    expect($lead->source)->toBe('store')->and($lead->cart['items'][0]['quantity'])->toBe(2);
    $this->getJson('/api/v1/dashboard/leads')->assertOk()->assertJsonPath('data.0.source', 'store')->assertJsonPath('data.0.cart.items.0.quantity', 2)->assertJsonPath('data.0.cart.total', 200);

    storePost('store/events', ['type' => 'view'])->assertStatus(202);
    storePost('store/events', ['type' => 'view'])->assertStatus(202);
    storePost('store/events', ['type' => 'add_to_cart'])->assertStatus(202);
    checkout($store, [['product_id' => $product->id, 'quantity' => 1]])->assertCreated();

    $this->getJson('/api/v1/dashboard/store/analytics')->assertOk()
        ->assertJsonPath('data.totals.views', 2)->assertJsonPath('data.totals.add_to_cart', 1)->assertJsonPath('data.totals.orders', 1)
        ->assertJsonPath('data.top_products.0.units', 1);
    expect($lead->fresh()->status->value)->toBe('converted');
});

it('previews the store home in the builder with the real catalog', function () {
    $owner = storeOwner();
    asTenant($owner, function () {
        $c = Category::query()->create(['name' => 'أحذية', 'slug' => 'shoes', 'depth' => 0]);
        Product::factory()->create(['slug' => 'p1', 'name' => 'حذاء'])->categories()->attach($c);
        Product::factory()->create(['slug' => 'p2', 'in_store' => false]);
    });
    $this->postJson('/api/v1/dashboard/store/setup', ['content' => ['version' => 1, 'sections' => [storeSection('product_grid', ['source' => 'newest', 'limit' => 4])]]])->assertOk();
    $home = $this->getJson('/api/v1/dashboard/store')->json('data.home.id');

    $this->getJson("/api/v1/dashboard/pages/{$home}")->assertOk()->assertJsonPath('data.kind', 'store_home');
    $this->getJson("/api/v1/dashboard/pages/{$home}/preview")->assertOk()
        ->assertJsonPath('data.store.categories.0.slug', 'shoes')
        ->assertJsonPath('data.store.categories.0.products_count', 1)
        ->assertJsonCount(1, 'data.store.sample')
        ->assertJsonPath('data.store.sample.0.category_ids', fn ($ids) => count($ids) === 1);

    // A landing page previews without store data; another store's home is not reachable.
    $landing = asTenant($owner, fn () => LandingPage::factory()->create()->id);
    $this->getJson("/api/v1/dashboard/pages/{$landing}/preview")->assertOk()->assertJsonPath('data.store', null);
    Sanctum::actingAs(User::factory()->for(Tenant::factory()->onPlan('pro')->create())->create()->fresh(['tenant']));
    $this->getJson("/api/v1/dashboard/pages/{$home}/preview")->assertNotFound();
});
