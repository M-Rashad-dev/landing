<?php

declare(strict_types=1);

use App\Billing\SubscriptionManager;
use App\Enums\OrderStatus;
use App\Models\AbandonedLead;
use App\Models\Category;
use App\Models\DiscountCode;
use App\Models\Domain;
use App\Models\Identity;
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

/** Sets up a live store (prepared, design published, enabled) through the API. */
function liveStore(): Store
{
    test()->postJson('/api/v1/dashboard/store/setup')->assertOk();
    test()->postJson('/api/v1/dashboard/store/design/publish')->assertOk();
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
        'form_token' => app(FormToken::class)->issue('store:'.$store->id, time() - 10),
    ], $extra));
}

// --- dashboard: store, categories, pages ------------------------------------------------

it('keeps the store to plans with the store feature', function () {
    storeOwner('basic');

    $this->postJson('/api/v1/dashboard/store/setup')->assertForbidden()->assertJsonPath('feature', 'store');
    $this->postJson('/api/v1/dashboard/categories', ['name' => 'رجالي'])->assertForbidden();
    $this->getJson('/api/v1/dashboard/store')->assertOk()->assertJsonPath('data.exists', false);
});

it('creates the store with the starter design of «أساس», live only once published and switched on', function () {
    storeOwner();

    $this->postJson('/api/v1/dashboard/store/setup')
        ->assertOk()->assertJsonPath('data.theme_key', 'asas')->assertJsonPath('data.design.published_at', null)->assertJsonPath('data.live', false)
        ->assertJsonPath('data.themes.0.key', 'asas')->assertJsonPath('data.themes.0.active', true);
    $this->getJson('/api/v1/dashboard/pages')->assertJsonCount(0, 'data');

    $this->putJson('/api/v1/dashboard/store', ['is_enabled' => true])->assertOk()->assertJsonPath('data.live', false);
    $this->postJson('/api/v1/dashboard/store/design/publish')->assertOk();
    $this->getJson('/api/v1/dashboard/store')->assertJsonPath('data.live', true)->assertJsonPath('data.design.has_unpublished_changes', false);
});

it('validates store menus and the theme', function () {
    storeOwner();
    $this->postJson('/api/v1/dashboard/store/setup')->assertOk();

    $this->putJson('/api/v1/dashboard/store', ['menus' => ['header' => [['type' => 'url', 'label' => 'x', 'url' => 'javascript:alert(1)']], 'footer' => []]])
        ->assertStatus(422)->assertJsonValidationErrors(['menus.header.0.url']);
    $this->putJson('/api/v1/dashboard/store', ['theme_key' => 'malak'])->assertStatus(422);
    $this->putJson('/api/v1/dashboard/store', ['menus' => ['header' => [['type' => 'all_products', 'label' => '<b>كل المنتجات</b>']], 'footer' => []]])
        ->assertOk()->assertJsonPath('data.menus.header.0.label', 'كل المنتجات');
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
    $listId = asTenant($owner, fn () => collect(Store::query()->first()->design()->published['sections'])->firstWhere('type', 'products')['id']);
    storePublic('store')->assertOk()->assertJsonPath('data.theme_key', 'asas')->assertJsonPath('data.categories.0.slug', 'shirts')
        ->assertJsonPath('data.categories.0.products_count', 2)->assertJsonCount(2, 'data.data.products.'.$listId)
        ->assertJsonPath('data.design.settings.colors.primary', '#0b875b')->assertJsonPath('data.branding', true);
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

it('lists the products on offer, and hides sold-out products everywhere when the store says so', function () {
    $owner = storeOwner();
    asTenant($owner, function () {
        $bags = Category::query()->create(['name' => 'شنط', 'slug' => 'bags', 'depth' => 0]);
        $sale = Product::factory()->create(['slug' => 'sale', 'price' => '80.00', 'compare_at_price' => '100.00']);
        $soldOut = Product::factory()->create(['slug' => 'sold-out', 'price' => '50.00', 'compare_at_price' => '90.00', 'stock_mode' => 'product', 'stock' => 0]);
        $plain = Product::factory()->create(['slug' => 'plain', 'price' => '120.00']);
        foreach ([$sale, $soldOut, $plain] as $p) {
            $p->categories()->attach($bags);
        }
    });
    liveStore();

    $slugs = fn ($res) => array_column($res->json('data'), 'slug');
    expect($slugs(storePublic('store/products', ['offers' => 1])))->toEqualCanonicalizing(['sale', 'sold-out'])
        ->and($slugs(storePublic('store/products')))->toHaveCount(3);

    // «إظهار المنتجات اللي خلصت» off, then published.
    $design = $this->getJson('/api/v1/dashboard/store/design')->json('data');
    $design['draft']['settings']['general']['show_out_of_stock'] = false;
    $this->putJson('/api/v1/dashboard/store/design', ['draft' => $design['draft'], 'version' => $design['version']])->assertOk();
    $this->postJson('/api/v1/dashboard/store/design/publish')->assertOk();

    expect($slugs(storePublic('store/products', ['offers' => 1])))->toBe(['sale'])
        ->and($slugs(storePublic('store/products')))->not->toContain('sold-out');
    $listId = collect($design['draft']['sections'])->firstWhere('type', 'products')['id'];
    expect(array_column(storePublic('store')->json("data.data.products.{$listId}"), 'slug'))->not->toContain('sold-out');
    $product = storePublic('store/products/plain')->assertOk();
    expect(array_column($product->json('data.related'), 'slug'))->toBe(['sale']);
    // The page of a sold-out product still opens (a shared link keeps working).
    storePublic('store/products/sold-out')->assertOk()->assertJsonPath('data.product.available', false);
    storePublic('store/products', ['offers' => 'maybe'])->assertStatus(422);
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
        DiscountCode::factory()->create(['code' => 'A20', 'type' => 'fixed', 'applies_to' => 'products', 'value' => 20, 'stackable_with_offers' => true])->products()->attach($a, ['tenant_id' => $a->tenant_id]);

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

    storePost('store/leads', ['items' => [['product_id' => $product->id, 'quantity' => 2]], 'phone' => '01012345678', 'form_token' => app(FormToken::class)->issue('store:'.$store->id, time() - 10)])->assertStatus(202);
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

it('keeps abandoned carts by token, moves them to checkout, and converts them with the order', function () {
    $owner = storeOwner();
    $product = asTenant($owner, fn () => Product::factory()->create(['slug' => 'p', 'price' => '100.00']));
    $store = liveStore();
    $token = 'cart_'.str_repeat('a', 20);

    storePost('store/carts', ['cart_token' => $token, 'items' => [['product_id' => $product->id, 'quantity' => 1]]])->assertStatus(202);
    storePost('store/carts', ['cart_token' => $token, 'items' => [['product_id' => $product->id, 'quantity' => 3]]])->assertStatus(202);
    $lead = AbandonedLead::query()->withoutGlobalScopes()->where('source', 'cart')->firstOrFail();
    expect($lead->customer_phone)->toBeNull()->and($lead->quantity)->toBe(3)->and($lead->cart['total'])->toBe(300);
    $this->getJson('/api/v1/dashboard/leads?source=cart')->assertJsonCount(1, 'data')->assertJsonPath('meta.sources.cart', 1);
    storePost('store/carts', ['cart_token' => 'bad token', 'items' => []])->assertStatus(422)->assertJsonValidationErrors(['cart_token']);

    // An emptied cart is gone; a refilled one comes back.
    storePost('store/carts', ['cart_token' => $token, 'items' => []])->assertStatus(202);
    expect(AbandonedLead::query()->withoutGlobalScopes()->count())->toBe(0);
    storePost('store/carts', ['cart_token' => $token, 'items' => [['product_id' => $product->id, 'quantity' => 2]]])->assertStatus(202);

    // Reaching checkout with a phone: followed up as a checkout, not a cart.
    storePost('store/leads', ['items' => [['product_id' => $product->id, 'quantity' => 2]], 'phone' => '01012345678', 'cart_token' => $token, 'form_token' => app(FormToken::class)->issue('store:'.$store->id, time() - 10)])->assertStatus(202);
    expect(AbandonedLead::query()->withoutGlobalScopes()->pluck('source')->all())->toBe(['store']);

    // A cart with no phone converts through its token.
    $other = 'cart_'.str_repeat('b', 20);
    storePost('store/carts', ['cart_token' => $other, 'items' => [['product_id' => $product->id, 'quantity' => 1]]])->assertStatus(202);
    checkout($store, [['product_id' => $product->id, 'quantity' => 1]], ['cart_token' => $other, 'customer' => ['name' => 'منى', 'phone' => '01155555555', 'governorate' => 'القاهرة', 'address' => 'x']])->assertCreated();
    expect(AbandonedLead::query()->withoutGlobalScopes()->where('cart_token', $other)->value('status')->value)->toBe('converted');

    // The order made its customer.
    $this->getJson('/api/v1/dashboard/customers?q=01155555555')->assertJsonCount(1, 'data')->assertJsonPath('data.0.orders_count', 1);
});
