<?php

declare(strict_types=1);

use App\Actions\Orders\LinkCustomer;
use App\Enums\OrderStatus;
use App\Models\Customer;
use App\Models\CustomerLoginCode;
use App\Models\Domain;
use App\Models\Identity;
use App\Models\Order;
use App\Models\Product;
use App\Models\ProductReview;
use App\Models\Store;
use App\Models\Tenant;
use App\Models\User;
use App\Services\FormToken;
use App\Store\Accounts\CodeSender;
use Illuminate\Support\Facades\RateLimiter;
use Laravel\Sanctum\Sanctum;

const ACCOUNT_HOST = 'account-shop.localhost';

/** A live store on ACCOUNT_HOST, its owner signed in to the dashboard. */
function accountStore(string $host = ACCOUNT_HOST): array
{
    $tenant = Tenant::factory()->onPlan('pro')->create();
    $user = User::factory()->for($tenant)->create();
    Domain::factory()->for($tenant)->create(['host' => $host, 'active_host' => $host]);
    asTenant($tenant, fn () => Identity::factory()->default()->create());
    Sanctum::actingAs($user->fresh(['tenant']));
    test()->postJson('/api/v1/dashboard/store/setup')->assertOk();
    test()->postJson('/api/v1/dashboard/store/design/publish')->assertOk();
    test()->putJson('/api/v1/dashboard/store', ['is_enabled' => true])->assertOk();

    return [$tenant, Store::query()->withoutGlobalScopes()->where('tenant_id', $tenant->id)->firstOrFail()];
}

function accountCall(string $method, string $path, array $body = [], ?string $token = null, string $host = ACCOUNT_HOST)
{
    $headers = internalHeaders() + ($token === null ? [] : ['X-Customer-Token' => $token]);
    $uri = '/api/v1/public/store/'.$path;

    return $method === 'GET'
        ? test()->getJson($uri.'?'.http_build_query(['host' => $host] + $body), $headers)
        : test()->json($method, $uri, ['host' => $host] + $body, $headers);
}

/** Sends a code and signs in with it; returns the token. */
function signIn(string $phone = '01012345678', string $host = ACCOUNT_HOST): string
{
    $code = accountCall('POST', 'account/code', ['phone' => $phone, 'ip' => '41.0.0.9'], host: $host)->assertOk()->json('data.code');

    return accountCall('POST', 'account/verify', ['phone' => $phone, 'code' => $code], host: $host)->assertOk()->json('data.token');
}

beforeEach(fn () => RateLimiter::clear('customer-code-wait'));

it('signs a customer in with a one-time code on the same customers row', function () {
    [$tenant] = accountStore();
    $existing = asTenant($tenant, fn () => Customer::query()->create(['phone' => '+201012345678', 'name' => 'سارة محمد']));

    $sent = accountCall('POST', 'account/code', ['phone' => '٠١٠١٢٣٤٥٦٧٨'])->assertOk()
        ->assertJsonPath('data.channel', 'screen')->assertJsonPath('data.expires_in', 300);
    $code = $sent->json('data.code');
    expect($code)->toMatch('/^\d{6}$/')
        // Only the hash is kept.
        ->and(asTenant($tenant, fn () => CustomerLoginCode::query()->first()->code_hash))->not->toContain($code);

    $res = accountCall('POST', 'account/verify', ['phone' => '01012345678', 'code' => $code])->assertOk()
        ->assertJsonPath('data.customer.name', 'سارة محمد')->assertJsonPath('data.customer.phone', '+201012345678');
    $token = $res->json('data.token');
    expect(asTenant($tenant, fn () => Customer::query()->count()))->toBe(1)
        ->and(asTenant($tenant, fn () => $existing->fresh()->signed_up_at))->not->toBeNull();

    accountCall('GET', 'account', token: $token)->assertOk()->assertJsonPath('data.name', 'سارة محمد');
    // The code works once.
    accountCall('POST', 'account/verify', ['phone' => '01012345678', 'code' => $code])->assertStatus(422);

    accountCall('PUT', 'account', ['name' => 'سارة أحمد'], $token)->assertOk()->assertJsonPath('data.name', 'سارة أحمد');
    accountCall('POST', 'account/sign-out', token: $token)->assertNoContent();
    accountCall('GET', 'account', token: $token)->assertUnauthorized()->assertJsonPath('code', 'signed_out');
});

it('stops guessing: five wrong codes, waiting between codes, and limits per hour', function () {
    accountStore();
    $code = accountCall('POST', 'account/code', ['phone' => '01055555555'])->json('data.code');
    $wrong = $code === '111111' ? '222222' : '111111';

    for ($i = 4; $i >= 1; $i--) {
        accountCall('POST', 'account/verify', ['phone' => '01055555555', 'code' => $wrong])->assertStatus(422)->assertJsonPath('errors.code.0', __('accounts.code_wrong', ['left' => $i]));
    }
    accountCall('POST', 'account/verify', ['phone' => '01055555555', 'code' => $wrong])->assertStatus(422)->assertJsonPath('errors.code.0', __('accounts.code_expired'));
    // Even the right code is dead after that.
    accountCall('POST', 'account/verify', ['phone' => '01055555555', 'code' => $code])->assertStatus(422);

    // A new code needs a minute.
    accountCall('POST', 'account/code', ['phone' => '01055555555'])->assertStatus(429)->assertJsonPath('code', 'code_wait');
    accountCall('POST', 'account/code', ['phone' => 'abc'])->assertStatus(422);
    accountCall('POST', 'account/verify', ['phone' => '01055555555', 'code' => '12'])->assertStatus(422);
});

it('refuses to show codes on screen in production', function () {
    accountStore();
    app()->detectEnvironment(fn () => 'production');
    accountCall('POST', 'account/code', ['phone' => '01012345678'])->assertStatus(503)->assertJsonPath('code', 'sign_in_unavailable');
    app()->detectEnvironment(fn () => 'testing');
});

it('lets a real sender keep the code to itself', function () {
    app()->instance(CodeSender::class, new class implements CodeSender
    {
        public function channel(): string
        {
            return 'sms';
        }

        public function available(): bool
        {
            return true;
        }

        public function send(string $phone, string $code, string $storeName): bool
        {
            return false;
        }
    });
    accountStore();
    accountCall('POST', 'account/code', ['phone' => '01012345678'])->assertOk()->assertJsonPath('data.channel', 'sms')->assertJsonPath('data.code', null);
});

it('lists my orders with their stages, and orders placed while signed in go on my phone with the address saved', function () {
    [$tenant, $store] = accountStore();
    $product = asTenant($tenant, fn () => Product::factory()->create(['name' => 'ساعة', 'price' => '500.00']));
    // A guest order on the same phone, before the account existed.
    asTenant($tenant, fn () => Order::factory()->create(['customer_phone' => '+201012345678', 'order_number' => 900]))->id;
    asTenant($tenant, fn () => app(LinkCustomer::class)->handle(Order::query()->where('order_number', 900)->first()));
    $token = signIn();

    accountCall('POST', 'orders', [
        'items' => [['product_id' => $product->id, 'quantity' => 2]],
        // Another phone in the form: the signed-in phone wins.
        'customer' => ['name' => 'سارة', 'phone' => '01199999999', 'governorate' => 'الجيزة', 'address' => '12 شارع الهرم'],
        'form_token' => app(FormToken::class)->issue('store:'.$store->id, time() - 10),
        'save_address' => true,
    ], $token)->assertCreated();

    $list = accountCall('GET', 'account/orders', token: $token)->assertOk()->assertJsonCount(2, 'data')->assertJsonPath('meta.total', 2);
    $number = $list->json('data.0.order_number');
    expect($list->json('data.0.items_count'))->toBe(2)->and($list->json('data.1.order_number'))->toBe(900);

    accountCall('GET', "account/orders/{$number}", token: $token)->assertOk()
        ->assertJsonPath('data.stage', 'received')->assertJsonPath('data.items.0.name', 'ساعة')
        ->assertJsonPath('data.items.0.can_review', false)->assertJsonPath('data.history.0.stage', 'received');
    accountCall('GET', 'account', token: $token)->assertJsonPath('data.addresses.0.address', '12 شارع الهرم')->assertJsonPath('data.addresses.0.is_default', true);
    accountCall('GET', 'account/orders/999999', token: $token)->assertNotFound();
    accountCall('GET', 'account/orders')->assertUnauthorized();
});

it('keeps saved addresses: one default, at most ten, validated', function () {
    accountStore();
    $token = signIn();
    $a = accountCall('POST', 'account/addresses', ['name' => 'البيت', 'governorate' => 'القاهرة', 'address' => '5 شارع النيل'], $token)->assertCreated()->assertJsonPath('data.is_default', true)->json('data.id');
    $b = accountCall('POST', 'account/addresses', ['name' => 'الشغل', 'governorate' => 'الجيزة', 'address' => 'برج 4، الدقي', 'is_default' => true], $token)->assertCreated()->json('data.id');
    accountCall('GET', 'account', token: $token)->assertJsonPath('data.addresses.0.id', $b)->assertJsonPath('data.addresses.1.is_default', false);

    accountCall('PUT', "account/addresses/{$a}", ['name' => 'البيت', 'governorate' => 'القاهرة', 'address' => '7 شارع النيل'], $token)->assertOk()->assertJsonPath('data.address', '7 شارع النيل');
    accountCall('DELETE', "account/addresses/{$b}", token: $token)->assertNoContent();
    accountCall('GET', 'account', token: $token)->assertJsonPath('data.addresses.0.is_default', true)->assertJsonCount(1, 'data.addresses');

    accountCall('POST', 'account/addresses', ['name' => 'x', 'governorate' => 'باريس', 'address' => 'ق'], $token)->assertStatus(422)->assertJsonValidationErrors(['name', 'governorate', 'address']);
    for ($i = 0; $i < 9; $i++) {
        accountCall('POST', 'account/addresses', ['name' => 'عنوان', 'governorate' => 'القاهرة', 'address' => "شارع رقم {$i}"], $token)->assertCreated();
    }
    accountCall('POST', 'account/addresses', ['name' => 'عنوان', 'governorate' => 'القاهرة', 'address' => 'شارع زيادة'], $token)->assertStatus(422);
});

it('lets only customers who received a product review it; reviews show at once and the merchant can hide them', function () {
    [$tenant] = accountStore();
    [$watch, $other] = asTenant($tenant, fn () => [Product::factory()->create(['name' => 'ساعة', 'slug' => 'watch']), Product::factory()->create(['slug' => 'other'])]);
    $token = signIn();
    accountCall('PUT', 'account', ['name' => 'سارة محمود'], $token)->assertOk();
    $customer = asTenant($tenant, fn () => Customer::query()->where('phone', '+201012345678')->first());
    $order = asTenant($tenant, function () use ($customer, $watch) {
        $order = Order::factory()->create(['customer_phone' => $customer->phone, 'customer_id' => $customer->id, 'status' => OrderStatus::Shipped]);
        $order->items()->create(['product_id' => $watch->id, 'product_name' => 'ساعة', 'unit_price' => '500.00', 'quantity' => 1, 'line_total' => '500.00']);

        return $order;
    });

    // Not delivered yet.
    accountCall('PUT', 'account/reviews', ['product_id' => $watch->id, 'rating' => 5, 'text' => 'حلوة'], $token)->assertStatus(422)->assertJsonValidationErrors('product_id');
    asTenant($tenant, fn () => $order->forceFill(['status' => OrderStatus::Delivered])->save());
    accountCall('GET', "account/orders/{$order->order_number}", token: $token)->assertJsonPath('data.items.0.can_review', true);

    accountCall('PUT', 'account/reviews', ['product_id' => $watch->id, 'rating' => 4, 'text' => '<b>جميلة</b> جدًا'], $token)->assertOk()->assertJsonPath('data.text', 'جميلة جدًا');
    // Writing again edits the same review.
    accountCall('PUT', 'account/reviews', ['product_id' => $watch->id, 'rating' => 5, 'text' => 'جميلة جدًا والتغليف ممتاز'], $token)->assertOk();
    expect(asTenant($tenant, fn () => ProductReview::query()->count()))->toBe(1);
    accountCall('PUT', 'account/reviews', ['product_id' => $other->id, 'rating' => 5], $token)->assertStatus(422);
    accountCall('PUT', 'account/reviews', ['product_id' => $watch->id, 'rating' => 9], $token)->assertStatus(422)->assertJsonValidationErrors('rating');

    // Public: the review, the summary, the card, the product page, and the home section.
    accountCall('GET', 'products/watch/reviews')->assertOk()->assertJsonPath('data.0.rating', 5)->assertJsonPath('data.0.name', 'سارة م.')
        ->assertJsonPath('meta.summary.count', 1)->assertJsonPath('meta.summary.average', 5)->assertJsonPath('meta.summary.stars.5', 1);
    accountCall('GET', 'products/watch')->assertJsonPath('data.rating.count', 1);
    $cards = collect(accountCall('GET', 'products')->json('data'))->keyBy('slug');
    expect($cards['watch']['rating'])->toBe(['average' => 5, 'count' => 1])->and($cards['other']['rating'])->toBeNull();
    expect(accountCall('GET', '')->json('data.data.reviews.0.text'))->toBe('جميلة جدًا والتغليف ممتاز');

    // The merchant hides it.
    $id = $this->getJson('/api/v1/dashboard/reviews')->assertOk()->assertJsonPath('meta.counts.all', 1)->assertJsonPath('data.0.customer.phone', '+201012345678')->json('data.0.id');
    $this->patchJson("/api/v1/dashboard/reviews/{$id}", ['is_hidden' => true])->assertOk()->assertJsonPath('data.is_hidden', true);
    $this->getJson('/api/v1/dashboard/reviews?status=hidden')->assertJsonCount(1, 'data');
    $this->getJson('/api/v1/dashboard/reviews?rating=9')->assertStatus(422);
    accountCall('GET', 'products/watch/reviews')->assertJsonCount(0, 'data');
    expect(accountCall('GET', '')->json('data.data.reviews'))->toBe([]);
});

it('keeps accounts and reviews to their own store', function () {
    [$tenantA] = accountStore();
    $tokenA = signIn();
    asTenant($tenantA, function () {
        $c = Customer::query()->first();
        $p = Product::factory()->create(['slug' => 'a-watch']);
        ProductReview::query()->create(['product_id' => $p->id, 'customer_id' => $c->id, 'rating' => 5, 'author_name' => 'سارة']);
    });
    $reviewA = asTenant($tenantA, fn () => ProductReview::query()->first()->id);

    accountStore('other-shop.localhost');
    // A token from store A means nothing on store B.
    accountCall('GET', 'account', token: $tokenA, host: 'other-shop.localhost')->assertUnauthorized();
    accountCall('GET', 'account', token: 'x', host: 'other-shop.localhost')->assertUnauthorized();
    // Store B's owner cannot see or hide store A's review.
    $this->getJson('/api/v1/dashboard/reviews')->assertJsonCount(0, 'data');
    $this->patchJson("/api/v1/dashboard/reviews/{$reviewA}", ['is_hidden' => true])->assertNotFound();

    app('auth')->forgetGuards();
    $this->withHeaders(['Authorization' => ''])->getJson('/api/v1/dashboard/reviews')->assertUnauthorized();
});
