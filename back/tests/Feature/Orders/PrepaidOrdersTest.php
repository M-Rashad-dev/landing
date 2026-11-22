<?php

declare(strict_types=1);

use App\Enums\OrderPaymentState;
use App\Enums\OrderStatus;
use App\Mail\CustomerOrderMail;
use App\Models\Domain;
use App\Models\Identity;
use App\Models\LandingPage;
use App\Models\Order;
use App\Models\OrderPayment;
use App\Models\Product;
use App\Models\Store;
use App\Models\StorePaymentMethod;
use App\Models\Tenant;
use App\Models\User;
use App\Models\UserNotification;
use App\Services\FormToken;
use Database\Factories\LandingPageFactory;
use Database\Seeders\ThemeSeeder;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Storage;
use Illuminate\Testing\TestResponse;
use Laravel\Sanctum\Sanctum;

const PP_HOST = 'paid.localhost';

beforeEach(function () {
    Mail::fake();
    Storage::fake('local');
    $this->seed(ThemeSeeder::class);
    $this->tenant = Tenant::factory()->onPlan('pro')->create(['name' => 'متجر حبة']);
    $this->owner = User::factory()->for($this->tenant)->create();
    Domain::factory()->for($this->tenant)->create(['host' => PP_HOST, 'active_host' => PP_HOST, 'is_primary' => true]);
    asTenant($this->tenant, fn () => Identity::factory()->default()->create());
    Sanctum::actingAs($this->owner->fresh(['tenant']));
});

function ppStore(): Store
{
    test()->postJson('/api/v1/dashboard/store/setup')->assertOk();
    test()->postJson('/api/v1/dashboard/store/design/publish')->assertOk();
    test()->putJson('/api/v1/dashboard/store', ['is_enabled' => true])->assertOk();

    return asTenant(test()->tenant, fn () => Store::query()->firstOrFail());
}

function ppMethod(array $body = []): StorePaymentMethod
{
    test()->postJson('/api/v1/dashboard/payments/methods', $body + ['kind' => 'wallet', 'name' => 'فودافون كاش', 'account' => '01012345678', 'instructions' => 'حوّل واكتب رقم الطلب'])->assertCreated();

    return asTenant(test()->tenant, fn () => StorePaymentMethod::query()->latest('id')->firstOrFail());
}

function ppProduct(int $stock = 5): Product
{
    return asTenant(test()->tenant, fn () => Product::factory()->create(['name' => 'كورس', 'price' => '200.00', 'in_store' => true, 'stock_mode' => Product::STOCK_PRODUCT, 'stock' => $stock]));
}

function ppCheckout(Store $store, Product $product, array $extra = []): TestResponse
{
    return test()->postJson('/api/v1/public/store/orders', [
        'host' => PP_HOST,
        'items' => [['product_id' => $product->id, 'quantity' => 1]],
        'customer' => ['name' => 'سارة محمد', 'phone' => '01012345678', 'governorate' => 'القاهرة', 'address' => 'شارع 9', 'email' => 'sara@example.com'],
        'form_token' => app(FormToken::class)->issue('store:'.$store->id, time() - 10),
    ] + $extra, internalHeaders());
}

function ppToken(): string
{
    return (string) asTenant(test()->tenant, fn () => Order::query()->latest('id')->value('track_token'));
}

function ppReceipt(string $token, int $methodId, ?UploadedFile $file = null): TestResponse
{
    return test()->post('/api/v1/public/payments', ['host' => PP_HOST, 'token' => $token, 'method_id' => $methodId, 'sender_ref' => '01099998888', 'receipt' => $file ?? UploadedFile::fake()->image('receipt.jpg')], internalHeaders() + ['Accept' => 'application/json']);
}

it('keeps the store\'s payment methods, checked by kind, to the store', function () {
    $this->getJson('/api/v1/dashboard/payments')->assertOk()->assertJsonPath('data.cod_enabled', true)->assertJsonPath('data.cancel_after_days', 3)->assertJsonPath('data.methods', []);

    $this->postJson('/api/v1/dashboard/payments/methods', ['kind' => 'link', 'name' => 'ادفع أونلاين'])->assertStatus(422)->assertJsonValidationErrors(['link']);
    $this->postJson('/api/v1/dashboard/payments/methods', ['kind' => 'wallet', 'name' => 'فودافون كاش'])->assertStatus(422)->assertJsonValidationErrors(['account']);
    $this->postJson('/api/v1/dashboard/payments/methods', ['kind' => 'link', 'name' => 'x', 'link' => 'http://pay.example.com'])->assertStatus(422)->assertJsonValidationErrors(['link']);
    $this->postJson('/api/v1/dashboard/payments/methods', ['kind' => 'cash', 'name' => 'x'])->assertStatus(422)->assertJsonValidationErrors(['kind']);
    $this->postJson('/api/v1/dashboard/payments/methods', ['kind' => 'instapay', 'name' => 'إنستاباي', 'link' => 'https://ipn.eg/S/habba/instapay/1'])->assertCreated()->assertJsonPath('data.methods.0.kind', 'instapay');

    $wallet = ppMethod();
    $this->putJson("/api/v1/dashboard/payments/methods/{$wallet->id}", ['kind' => 'wallet', 'name' => 'فودافون كاش', 'account' => '01100000000', 'is_active' => false])->assertOk()
        ->assertJsonPath('data.methods.1.account', '01100000000')->assertJsonPath('data.methods.1.is_active', false);
    $this->putJson('/api/v1/dashboard/payments/settings', ['cod_enabled' => false, 'cancel_after_days' => 0])->assertStatus(422)->assertJsonValidationErrors(['cancel_after_days']);
    $this->putJson('/api/v1/dashboard/payments/settings', ['cod_enabled' => false, 'cancel_after_days' => 2])->assertOk()->assertJsonPath('data.cod_enabled', false);

    Sanctum::actingAs(createOwner());
    $this->putJson("/api/v1/dashboard/payments/methods/{$wallet->id}", ['kind' => 'wallet', 'name' => 'x', 'account' => '1'])->assertNotFound();
    $this->deleteJson("/api/v1/dashboard/payments/methods/{$wallet->id}")->assertNotFound();
    $this->getJson('/api/v1/dashboard/payments')->assertOk()->assertJsonPath('data.methods', []);
    app('auth')->forgetGuards();
    $this->withHeaders(['Authorization' => ''])->getJson('/api/v1/dashboard/payments')->assertUnauthorized();
});

it('offers cash on delivery and the active methods at checkout, and never leaves a store without a way to pay', function () {
    $store = ppStore();
    $product = ppProduct();
    $this->putJson('/api/v1/dashboard/payments/settings', ['cod_enabled' => false, 'cancel_after_days' => 3])->assertOk();

    // Nothing else to pay with: cash on delivery stays.
    $this->getJson('/api/v1/public/store?host='.PP_HOST, internalHeaders())->assertOk()->assertJsonPath('data.payments.cod', true);
    ppCheckout($store, $product)->assertCreated()->assertJsonPath('data.pay_url', null);

    $wallet = ppMethod();
    $this->getJson('/api/v1/public/store?host='.PP_HOST, internalHeaders())->assertOk()
        ->assertJsonPath('data.payments.cod', false)
        ->assertJsonPath('data.payments.methods.0.name', 'فودافون كاش');
    ppCheckout($store, $product)->assertStatus(422)->assertJsonValidationErrors(['payment_method']);
    ppCheckout($store, $product, ['payment_method' => 'cod'])->assertStatus(422)->assertJsonValidationErrors(['payment_method']);
    ppCheckout($store, $product, ['payment_method' => '999'])->assertStatus(422)->assertJsonValidationErrors(['payment_method']);
    ppCheckout($store, $product, ['payment_method' => (string) $wallet->id])->assertCreated();
});

it('takes a prepaid order that waits for its payment, tells the customer how to pay, and takes the receipt once', function () {
    $store = ppStore();
    $product = ppProduct(5);
    $wallet = ppMethod();

    $payUrl = ppCheckout($store, $product, ['payment_method' => (string) $wallet->id])->assertCreated()->json('data.pay_url');
    $order = asTenant($this->tenant, fn () => Order::query()->sole());
    expect($order->status)->toBe(OrderStatus::AwaitingPayment)
        ->and($order->payment_method)->toBe(Order::PREPAID)
        ->and($order->payment_status)->toBe(OrderPaymentState::Unpaid)
        ->and($order->payment_method_name)->toBe('فودافون كاش')
        ->and($payUrl)->toEndWith('/pay/'.$order->track_token)
        ->and(asTenant($this->tenant, fn () => $product->fresh()->stock))->toBe(4);
    Mail::assertSent(CustomerOrderMail::class, fn (CustomerOrderMail $m) => $m->event === 'payment_due' && $m->hasTo('sara@example.com') && $m->actionUrl === $payUrl);

    // The pay page: the total and where to pay, for this store's host only.
    $this->postJson('/api/v1/public/payments/lookup', ['host' => PP_HOST, 'token' => $order->track_token], internalHeaders())->assertOk()
        ->assertJsonPath('data.status', 'awaiting')
        ->assertJsonPath('data.total', 200)
        ->assertJsonPath('data.can_send', true)
        ->assertJsonPath('data.methods.0.account', '01012345678');
    $other = Tenant::factory()->create();
    Domain::factory()->for($other)->create(['host' => 'other.localhost', 'active_host' => 'other.localhost']);
    $this->postJson('/api/v1/public/payments/lookup', ['host' => 'other.localhost', 'token' => $order->track_token], internalHeaders())->assertNotFound();

    ppReceipt($order->track_token, $wallet->id, UploadedFile::fake()->create('a.zip', 10, 'application/zip'))->assertStatus(422)->assertJsonValidationErrors(['receipt']);
    ppReceipt($order->track_token, $wallet->id)->assertCreated()->assertJsonPath('data.can_send', false)->assertJsonPath('data.receipts.0.status', 'pending');
    ppReceipt($order->track_token, $wallet->id)->assertStatus(409);

    expect(asTenant($this->tenant, fn () => $order->fresh()->payment_status))->toBe(OrderPaymentState::Review)
        ->and(UserNotification::query()->where('event', 'payment_receipt')->count())->toBe(1);
    $receipt = asTenant($this->tenant, fn () => OrderPayment::query()->sole());
    Storage::disk('local')->assertExists($receipt->receipt_path);
    expect($receipt->receipt_path)->toStartWith('order-receipts/'.$this->tenant->id.'/');

    // The merchant sees it, opens the receipt and accepts it: the order is confirmed and paid.
    $this->getJson("/api/v1/dashboard/orders/{$order->id}")->assertOk()
        ->assertJsonPath('data.payment.status', 'review')
        ->assertJsonPath('data.payment.receipts.0.sender_ref', '01099998888')
        ->assertJsonPath('data.payment_status', 'review');
    $this->get("/api/v1/dashboard/orders/{$order->id}/payments/{$receipt->id}/receipt")->assertOk()->assertHeader('X-Content-Type-Options', 'nosniff');
    $this->getJson('/api/v1/dashboard/orders?payment=review')->assertOk()->assertJsonCount(1, 'data');
    $this->postJson("/api/v1/dashboard/orders/{$order->id}/payments/{$receipt->id}/approve")->assertOk()->assertJsonPath('data.status', 'confirmed')->assertJsonPath('data.payment_status', 'paid');
    $this->postJson("/api/v1/dashboard/orders/{$order->id}/payments/{$receipt->id}/approve")->assertStatus(409);

    $order->refresh();
    expect(asTenant($this->tenant, fn () => $order->fresh()->paid_at))->not->toBeNull();
    Mail::assertSent(CustomerOrderMail::class, fn (CustomerOrderMail $m) => $m->event === 'payment_confirmed');
    $this->postJson('/api/v1/public/payments/lookup', ['host' => PP_HOST, 'token' => $order->track_token], internalHeaders())->assertOk()->assertJsonPath('data.status', 'paid')->assertJsonPath('data.methods', []);

    // Another store can't see or answer it.
    Sanctum::actingAs(createOwner());
    $this->get("/api/v1/dashboard/orders/{$order->id}/payments/{$receipt->id}/receipt")->assertNotFound();
});

it('refuses a receipt with a reason, and the customer sends another', function () {
    $store = ppStore();
    $wallet = ppMethod();
    ppCheckout($store, ppProduct(), ['payment_method' => (string) $wallet->id])->assertCreated();
    $token = ppToken();
    ppReceipt($token, $wallet->id)->assertCreated();
    $order = asTenant($this->tenant, fn () => Order::query()->sole());
    $receipt = asTenant($this->tenant, fn () => OrderPayment::query()->sole());

    $this->postJson("/api/v1/dashboard/orders/{$order->id}/payments/{$receipt->id}/reject", [])->assertStatus(422)->assertJsonValidationErrors(['reason']);
    $this->postJson("/api/v1/dashboard/orders/{$order->id}/payments/{$receipt->id}/reject", ['reason' => 'المبلغ ناقص 50 جنيه'])->assertOk()
        ->assertJsonPath('data.status', 'awaiting_payment')->assertJsonPath('data.payment_status', 'unpaid');
    Mail::assertSent(CustomerOrderMail::class, fn (CustomerOrderMail $m) => $m->event === 'payment_rejected' && str_contains($m->intro, 'المبلغ ناقص 50 جنيه'));

    $this->postJson('/api/v1/public/payments/lookup', ['host' => PP_HOST, 'token' => $token], internalHeaders())->assertOk()
        ->assertJsonPath('data.can_send', true)->assertJsonPath('data.receipts.0.reject_reason', 'المبلغ ناقص 50 جنيه');
    ppReceipt($token, $wallet->id)->assertCreated();
    expect(asTenant($this->tenant, fn () => OrderPayment::query()->count()))->toBe(2);
});

it('marks a prepaid order paid when the merchant confirms it by hand', function () {
    $store = ppStore();
    $wallet = ppMethod();
    ppCheckout($store, ppProduct(), ['payment_method' => (string) $wallet->id])->assertCreated();
    $order = asTenant($this->tenant, fn () => Order::query()->sole());

    $this->postJson("/api/v1/dashboard/orders/{$order->id}/status", ['status' => 'shipped'])->assertStatus(422);
    $this->postJson("/api/v1/dashboard/orders/{$order->id}/status", ['status' => 'confirmed'])->assertOk();

    expect(asTenant($this->tenant, fn () => $order->fresh()->payment_status))->toBe(OrderPaymentState::Paid);
});

it('cancels unpaid orders after the store\'s days, unless a receipt waits', function () {
    $store = ppStore();
    $product = ppProduct(5);
    $wallet = ppMethod();
    foreach (range(1, 3) as $i) {
        ppCheckout($store, $product, ['payment_method' => (string) $wallet->id, 'customer' => ['name' => 'عميل', 'phone' => '0101234567'.$i, 'governorate' => 'القاهرة', 'address' => 'شارع 9']])->assertCreated();
    }
    [$old, $waiting, $fresh] = asTenant($this->tenant, fn () => Order::query()->orderBy('id')->get()->all());
    asTenant($this->tenant, function () use ($old, $waiting): void {
        $old->forceFill(['created_at' => now()->subDays(4)])->save();
        $waiting->forceFill(['created_at' => now()->subDays(4)])->save();
    });
    ppReceipt((string) $waiting->track_token, $wallet->id)->assertCreated();

    $this->artisan('orders:cancel-unpaid')->assertSuccessful();

    expect(asTenant($this->tenant, fn () => Order::query()->orderBy('id')->pluck('status')->map->value->all()))->toBe(['cancelled', 'awaiting_payment', 'awaiting_payment'])
        ->and(asTenant($this->tenant, fn () => $product->fresh()->stock))->toBe(3);
});

it('takes prepaid orders on landing pages too', function () {
    $product = ppProduct();
    $wallet = ppMethod();
    $page = asTenant($this->tenant, fn () => LandingPage::factory()->withSections([
        LandingPageFactory::section('hero', ['title' => 'x'], true, 'split'),
        LandingPageFactory::section('order_form', ['fields' => ['name' => ['enabled' => true, 'required' => true], 'phone' => ['enabled' => true, 'required' => true], 'governorate' => ['enabled' => true, 'required' => true], 'address' => ['enabled' => true, 'required' => true]], 'custom_fields' => []], true, 'card'),
    ])->published()->create(['slug' => 'course', 'product_id' => $product->id]));

    $this->getJson('/api/v1/public/pages?host='.PP_HOST.'&slug=course', internalHeaders())->assertOk()->assertJsonPath('data.payments.methods.0.id', $wallet->id);
    $url = $this->postJson('/api/v1/public/orders', [
        'host' => PP_HOST, 'slug' => 'course', 'quantity' => 1, 'payment_method' => (string) $wallet->id,
        'customer' => ['name' => 'أحمد علي', 'phone' => '01012345678', 'governorate' => 'القاهرة', 'address' => 'شارع النصر 10'],
        'form_token' => app(FormToken::class)->issue($page->id, time() - 10),
    ], internalHeaders())->assertCreated()->json('data.pay_url');

    expect($url)->toContain('/pay/')
        ->and(asTenant($this->tenant, fn () => Order::query()->sole()->status))->toBe(OrderStatus::AwaitingPayment);
});

it('won\'t delete a method customers are still paying with', function () {
    $store = ppStore();
    $wallet = ppMethod();
    ppCheckout($store, ppProduct(), ['payment_method' => (string) $wallet->id])->assertCreated();

    $this->deleteJson("/api/v1/dashboard/payments/methods/{$wallet->id}")->assertStatus(422)->assertJsonPath('code', 'method_used');
    $other = ppMethod(['name' => 'إنستاباي', 'kind' => 'instapay', 'account' => 'habba@instapay']);
    $this->deleteJson("/api/v1/dashboard/payments/methods/{$other->id}")->assertNoContent();
});
