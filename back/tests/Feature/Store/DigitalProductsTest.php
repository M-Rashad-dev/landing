<?php

declare(strict_types=1);

use App\Enums\OrderStatus;
use App\Mail\CustomerOrderMail;
use App\Models\Domain;
use App\Models\Identity;
use App\Models\LandingPage;
use App\Models\Order;
use App\Models\OrderDelivery;
use App\Models\OrderPayment;
use App\Models\Product;
use App\Models\ProductCode;
use App\Models\Store;
use App\Models\StorePaymentMethod;
use App\Models\Tenant;
use App\Models\User;
use App\Models\UserNotification;
use App\Services\FormToken;
use App\Store\Digital\DigitalCodes;
use Database\Factories\LandingPageFactory;
use Database\Seeders\ThemeSeeder;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Storage;
use Illuminate\Testing\TestResponse;
use Laravel\Sanctum\Sanctum;

const DG_HOST = 'digital.localhost';

beforeEach(function () {
    Mail::fake();
    Storage::fake('local');
    $this->seed(ThemeSeeder::class);
    $this->tenant = Tenant::factory()->onPlan('pro')->create(['name' => 'متجر الشحن']);
    $this->owner = User::factory()->for($this->tenant)->create();
    Domain::factory()->for($this->tenant)->create(['host' => DG_HOST, 'active_host' => DG_HOST, 'is_primary' => true]);
    asTenant($this->tenant, fn () => Identity::factory()->default()->create());
    Sanctum::actingAs($this->owner->fresh(['tenant']));
    $this->postJson('/api/v1/dashboard/store/setup')->assertOk();
    $this->postJson('/api/v1/dashboard/store/design/publish')->assertOk();
    $this->putJson('/api/v1/dashboard/store', ['is_enabled' => true])->assertOk();
    $this->store = asTenant($this->tenant, fn () => Store::query()->firstOrFail());
    $this->postJson('/api/v1/dashboard/payments/methods', ['kind' => 'wallet', 'name' => 'فودافون كاش', 'account' => '01012345678'])->assertCreated();
    $this->wallet = asTenant($this->tenant, fn () => StorePaymentMethod::query()->firstOrFail());
});

function dgProduct(string $type, array $settings = [], array $extra = []): Product
{
    $id = test()->postJson('/api/v1/dashboard/products', $extra + [
        'name' => match ($type) {
            'files' => 'كتاب الطبخ', 'codes' => 'شدات ببجي', 'links' => 'كورس فيديو', default => 'متابعين انستجرام'
        },
        'price' => 100, 'in_store' => true, 'kind' => 'digital', 'delivery_type' => $type, 'delivery_settings' => $settings,
    ])->assertCreated()->json('data.id');

    return asTenant(test()->tenant, fn () => Product::query()->findOrFail($id));
}

function dgCheckout(array $items, array $extra = []): TestResponse
{
    return test()->postJson('/api/v1/public/store/orders', array_replace_recursive([
        'host' => DG_HOST,
        'items' => $items,
        'customer' => ['name' => 'سارة محمد', 'phone' => '01012345678', 'email' => 'sara@example.com'],
        'form_token' => app(FormToken::class)->issue('store:'.test()->store->id, time() - 10),
        'payment_method' => (string) test()->wallet->id,
    ], $extra), internalHeaders());
}

/** The customer pays and the merchant accepts the receipt: the order is confirmed and delivered. */
function dgPay(): Order
{
    $order = asTenant(test()->tenant, fn () => Order::query()->latest('id')->firstOrFail());
    test()->post('/api/v1/public/payments', ['host' => DG_HOST, 'token' => $order->track_token, 'method_id' => test()->wallet->id, 'receipt' => UploadedFile::fake()->image('r.jpg')], internalHeaders() + ['Accept' => 'application/json'])->assertCreated();
    $payment = asTenant(test()->tenant, fn () => OrderPayment::query()->latest('id')->firstOrFail());
    test()->postJson("/api/v1/dashboard/orders/{$order->id}/payments/{$payment->id}/approve")->assertOk();

    return asTenant(test()->tenant, fn () => $order->fresh());
}

function dgDelivery(): OrderDelivery
{
    return asTenant(test()->tenant, fn () => OrderDelivery::query()->latest('id')->firstOrFail());
}

it('makes a digital product with a delivery type, never tracked like stock', function () {
    $this->postJson('/api/v1/dashboard/products', ['name' => 'x', 'price' => 10, 'kind' => 'digital'])->assertStatus(422)->assertJsonValidationErrors(['delivery_type']);
    $this->postJson('/api/v1/dashboard/products', ['name' => 'x', 'price' => 10, 'kind' => 'digital', 'delivery_type' => 'links'])->assertStatus(422)->assertJsonValidationErrors(['delivery_settings.link']);
    $this->postJson('/api/v1/dashboard/products', ['name' => 'x', 'price' => 10, 'kind' => 'digital', 'delivery_type' => 'video'])->assertStatus(422)->assertJsonValidationErrors(['delivery_type']);

    $product = dgProduct('links', ['link' => 'https://videos.example.com/course', 'opens' => 3], ['stock_mode' => 'product', 'stock' => 4]);
    expect($product->stock_mode)->toBe(Product::STOCK_UNLIMITED)
        ->and($product->delivery_settings)->toBe(['link' => 'https://videos.example.com/course', 'opens' => 3])
        ->and($product->getRawOriginal('delivery_settings'))->not->toContain('videos.example.com');
    $this->getJson("/api/v1/dashboard/products/{$product->id}")->assertOk()->assertJsonPath('data.kind', 'digital')->assertJsonPath('data.delivery_settings.opens', 3);

    // The public page never shows the link.
    $json = $this->getJson('/api/v1/public/store/products/'.$product->slug.'?host='.DG_HOST, internalHeaders())->assertOk()->assertJsonPath('data.product.kind', 'digital')->json();
    expect(json_encode($json))->not->toContain('videos.example.com');
});

it('sells a digital order prepaid only, with the email, without an address or shipping', function () {
    $product = dgProduct('files', ['downloads' => 2]);

    dgCheckout([['product_id' => $product->id, 'quantity' => 1]], ['payment_method' => 'cod'])->assertStatus(422)->assertJsonValidationErrors(['payment_method']);
    dgCheckout([['product_id' => $product->id, 'quantity' => 1]], ['customer' => ['email' => '']])->assertStatus(422)->assertJsonValidationErrors(['customer.email']);
    dgCheckout([['product_id' => $product->id, 'quantity' => 1]])->assertCreated();

    $order = asTenant($this->tenant, fn () => Order::query()->with('items')->sole());
    expect($order->status)->toBe(OrderStatus::AwaitingPayment)
        ->and($order->governorate)->toBeNull()
        ->and((string) $order->shipping_fee)->toBe('0.00')
        ->and($order->items->first()->delivery_type)->toBe('files');

    // Without a prepaid method the store can't sell it.
    $this->deleteJson("/api/v1/dashboard/payments/methods/{$this->wallet->id}")->assertStatus(422);
    $this->putJson("/api/v1/dashboard/payments/methods/{$this->wallet->id}", ['kind' => 'wallet', 'name' => 'فودافون كاش', 'account' => '01012345678', 'is_active' => false])->assertOk();
    $this->getJson('/api/v1/public/store/products/'.$product->slug.'?host='.DG_HOST, internalHeaders())->assertOk()->assertJsonPath('data.product.available', false);
    dgCheckout([['product_id' => $product->id, 'quantity' => 1]], ['payment_method' => 'cod'])->assertStatus(422)->assertJsonPath('errors.payment_method.0', __('digital.no_prepaid'));
});

it('delivers files once paid: counted downloads, more on request, the order delivered by itself', function () {
    $product = dgProduct('files', ['downloads' => 2, 'message' => 'أهلاً {name}، كتابك جاهز ({order}).']);
    $this->post("/api/v1/dashboard/products/{$product->id}/files", ['name' => 'الكتاب', 'file' => UploadedFile::fake()->create('x.php', 10)], ['Accept' => 'application/json'])->assertStatus(422)->assertJsonValidationErrors(['file']);
    $fileId = $this->post("/api/v1/dashboard/products/{$product->id}/files", ['name' => 'الكتاب', 'file' => UploadedFile::fake()->create('book.pdf', 500, 'application/pdf')], ['Accept' => 'application/json'])->assertCreated()->json('data.id');

    dgCheckout([['product_id' => $product->id, 'quantity' => 1]])->assertCreated();
    $order = dgPay();
    $delivery = dgDelivery();

    expect($order->status)->toBe(OrderStatus::Delivered)->and($delivery->status)->toBe('delivered')->and($delivery->limit)->toBe(2);
    Mail::assertSent(CustomerOrderMail::class, fn (CustomerOrderMail $m) => $m->event === 'digital_delivery' && $m->intro === 'أهلاً سارة محمد، كتابك جاهز ('.$order->order_number.').');

    $url = '/api/v1/public/deliveries/'.$delivery->token.'/files/'.$fileId.'?host='.DG_HOST;
    $response = $this->get($url, internalHeaders())->assertOk();
    // The customer's file name, in Arabic (with a plain fallback for old browsers).
    expect((string) $response->headers->get('Content-Disposition'))->toContain(rawurlencode('الكتاب.pdf'));
    $this->get($url, internalHeaders())->assertOk();
    $this->getJson($url, internalHeaders())->assertStatus(410)->assertJsonPath('code', 'downloads_used_up');
    $this->getJson('/api/v1/public/deliveries/'.$delivery->token.'/files/'.$fileId.'?host=other.localhost', internalHeaders())->assertNotFound();

    $this->postJson("/api/v1/dashboard/orders/{$order->id}/deliveries/{$delivery->id}/grant", ['count' => 1])->assertOk()->assertJsonPath('data.bonus', 1);
    $this->get($url, internalHeaders())->assertOk();

    // The order page lists the file with what's left.
    $this->postJson('/api/v1/public/payments/lookup', ['host' => DG_HOST, 'token' => $order->track_token], internalHeaders())->assertOk()
        ->assertJsonPath('data.status', 'paid')
        ->assertJsonPath('data.deliveries.0.files.0.left', 0)
        ->assertJsonPath('data.deliveries.0.files.0.name', 'الكتاب');
});

it('sends codes in the merchant\'s order, one per unit, and waits for more when they run out', function () {
    $product = dgProduct('codes');
    $this->postJson("/api/v1/dashboard/products/{$product->id}/codes", ['codes' => [['code' => 'AAA-111'], ['code' => "user: a@b.com\npass: 123", 'uses' => 2], ['code' => 'CCC-333']]])->assertCreated()
        ->assertJsonPath('data.combinations.0.left', 4)->assertJsonCount(3, 'data.codes');
    $ids = asTenant($this->tenant, fn () => ProductCode::query()->orderBy('position')->pluck('id')->all());
    $this->putJson("/api/v1/dashboard/products/{$product->id}/codes/order", ['ids' => [$ids[2], $ids[0], $ids[1]]])->assertOk()->assertJsonPath('data.codes.0.code', 'CCC-333');
    expect(asTenant($this->tenant, fn () => ProductCode::query()->first()->getRawOriginal('code')))->not->toContain('-');
    $this->getJson('/api/v1/public/store/products/'.$product->slug.'?host='.DG_HOST, internalHeaders())->assertOk()->assertJsonPath('data.product.stock', 4)->assertJsonPath('data.product.stock_mode', 'product');

    dgCheckout([['product_id' => $product->id, 'quantity' => 5]])->assertStatus(422)->assertJsonValidationErrors(['items.0.quantity']);
    dgCheckout([['product_id' => $product->id, 'quantity' => 2]])->assertCreated();
    $order = dgPay();
    expect(dgDelivery()->payload['codes'])->toBe(['CCC-333', 'AAA-111'])->and($order->status)->toBe(OrderStatus::Delivered);
    Mail::assertSent(CustomerOrderMail::class, fn (CustomerOrderMail $m) => $m->event === 'digital_delivery' && in_array('CCC-333', array_column($m->rows, 'value'), true));

    // Two more units: one entry left (2 uses, never twice to one buyer) → waits; the merchant adds one and it goes.
    dgCheckout([['product_id' => $product->id, 'quantity' => 2]], ['customer' => ['phone' => '01022223333']])->assertCreated();
    $second = dgPay();
    expect($second->status)->toBe(OrderStatus::Confirmed)->and(dgDelivery()->status)->toBe('pending')
        ->and(UserNotification::query()->where('title', 'like', '%الأكواد خلصت%')->count())->toBe(1);

    $this->postJson("/api/v1/dashboard/products/{$product->id}/codes", ['codes' => [['code' => 'DDD-444']]])->assertCreated();
    expect(dgDelivery()->status)->toBe('delivered')->and(dgDelivery()->payload['codes'])->toBe(["user: a@b.com\npass: 123", 'DDD-444'])
        ->and(asTenant($this->tenant, fn () => $second->fresh()->status))->toBe(OrderStatus::Delivered);

    // «ابعت تاني» sends the same codes.
    $sent = Mail::sent(CustomerOrderMail::class)->count();
    $delivery = dgDelivery();
    $this->postJson("/api/v1/dashboard/orders/{$second->id}/deliveries/{$delivery->id}/resend")->assertOk();
    expect(Mail::sent(CustomerOrderMail::class)->count())->toBe($sent + 1)->and(dgDelivery()->payload['codes'])->toBe($delivery->payload['codes']);
});

it('keeps codes per option, like 60 UC and 325 UC', function () {
    $product = dgProduct('codes', [], ['options' => [['name' => 'الباقة', 'display_type' => 'buttons', 'is_required' => true, 'values' => [['label' => '60 UC'], ['label' => '325 UC', 'price_delta' => 150]]]]]);
    $list = $this->getJson("/api/v1/dashboard/products/{$product->id}/codes?combination_key=nope")->assertStatus(422);
    $combos = asTenant($this->tenant, fn () => app(DigitalCodes::class)->combinations($product->fresh()));
    expect(array_column($combos, 'label'))->toBe(['60 UC', '325 UC']);
    $this->postJson("/api/v1/dashboard/products/{$product->id}/codes", ['combination_key' => $combos[1]['key'], 'codes' => [['code' => 'BIG-1']]])->assertCreated();

    $json = $this->getJson('/api/v1/public/store/products/'.$product->slug.'?host='.DG_HOST, internalHeaders())->assertOk()->json('data.product');
    expect($json['stock_mode'])->toBe('variant')->and($json['variant_stock'])->toBe([$combos[1]['key'] => 1]);
    $option = $json['options'][0];
    dgCheckout([['product_id' => $product->id, 'quantity' => 1, 'options' => [$option['id'] => $option['values'][0]['id']]]])->assertStatus(422);
    dgCheckout([['product_id' => $product->id, 'quantity' => 1, 'options' => [$option['id'] => $option['values'][1]['id']]]])->assertCreated();
    dgPay();
    expect(dgDelivery()->payload['codes'])->toBe(['BIG-1']);
});

it('opens a link through us, counted', function () {
    $product = dgProduct('links', ['link' => 'https://videos.example.com/course', 'opens' => 1]);
    dgCheckout([['product_id' => $product->id, 'quantity' => 1]])->assertCreated();
    dgPay();
    $delivery = dgDelivery();

    $this->postJson('/api/v1/public/deliveries/'.$delivery->token.'/open', ['host' => DG_HOST], internalHeaders())->assertOk()->assertJsonPath('data.url', 'https://videos.example.com/course');
    $this->postJson('/api/v1/public/deliveries/'.$delivery->token.'/open', ['host' => DG_HOST], internalHeaders())->assertStatus(410);
    $this->postJson('/api/v1/public/deliveries/'.str_repeat('a', 40).'/open', ['host' => DG_HOST], internalHeaders())->assertNotFound();
});

it('waits for the merchant on a service, then sends his message', function () {
    $product = dgProduct('services', ['subject' => 'طلبك اتنفذ', 'message' => 'تم إضافة المتابعين يا {name}.'], ['inputs' => [['kind' => 'text', 'label' => 'اسم الحساب', 'is_required' => true]]]);
    $input = asTenant($this->tenant, fn () => $product->inputs()->firstOrFail());
    dgCheckout([['product_id' => $product->id, 'quantity' => 1, 'inputs' => [$input->id => '@sara']]])->assertCreated();
    $order = dgPay();
    $delivery = dgDelivery();
    expect($order->status)->toBe(OrderStatus::Confirmed)->and($delivery->status)->toBe('pending');
    Mail::assertNotSent(CustomerOrderMail::class, fn (CustomerOrderMail $m) => $m->event === 'digital_delivery');

    $this->getJson("/api/v1/dashboard/orders/{$order->id}")->assertOk()->assertJsonPath('data.deliveries.0.default_message', 'تم إضافة المتابعين يا {name}.');
    $this->postJson("/api/v1/dashboard/orders/{$order->id}/deliveries/{$delivery->id}/complete", ['subject' => '', 'message' => ''])->assertStatus(422)->assertJsonValidationErrors(['subject', 'message']);
    $this->postJson("/api/v1/dashboard/orders/{$order->id}/deliveries/{$delivery->id}/complete", ['subject' => 'طلبك اتنفذ', 'message' => 'اتضاف 1000 متابع على @sara.'])->assertOk()->assertJsonPath('data.status', 'delivered');

    Mail::assertSent(CustomerOrderMail::class, fn (CustomerOrderMail $m) => $m->event === 'digital_delivery' && $m->heading === 'طلبك اتنفذ' && $m->intro === 'اتضاف 1000 متابع على @sara.');
    expect(asTenant($this->tenant, fn () => $order->fresh()->status))->toBe(OrderStatus::Delivered);
});

it('ships the physical part of a mixed order and delivers the digital one', function () {
    $digital = dgProduct('links', ['link' => 'https://x.example.com/guide']);
    $shirt = asTenant($this->tenant, fn () => Product::factory()->create(['in_store' => true, 'price' => '300.00']));

    dgCheckout([['product_id' => $digital->id, 'quantity' => 1], ['product_id' => $shirt->id, 'quantity' => 1]], ['payment_method' => 'cod', 'customer' => ['governorate' => 'القاهرة', 'address' => 'شارع 9']])->assertStatus(422)->assertJsonValidationErrors(['payment_method']);
    dgCheckout([['product_id' => $digital->id, 'quantity' => 1], ['product_id' => $shirt->id, 'quantity' => 1]])->assertStatus(422)->assertJsonValidationErrors(['customer.governorate', 'customer.address']);
    dgCheckout([['product_id' => $digital->id, 'quantity' => 1], ['product_id' => $shirt->id, 'quantity' => 1]], ['customer' => ['governorate' => 'القاهرة', 'address' => 'شارع 9']])->assertCreated();
    $order = dgPay();

    expect($order->status)->toBe(OrderStatus::Confirmed)
        ->and(asTenant($this->tenant, fn () => OrderDelivery::query()->count()))->toBe(1);
});

it('sells digital products on landing pages without an address', function () {
    $product = dgProduct('links', ['link' => 'https://x.example.com/guide']);
    $page = asTenant($this->tenant, fn () => LandingPage::factory()->withSections([
        LandingPageFactory::section('hero', ['title' => 'x'], true, 'split'),
        LandingPageFactory::section('order_form', ['fields' => ['name' => ['enabled' => true, 'required' => true], 'phone' => ['enabled' => true, 'required' => true], 'governorate' => ['enabled' => true, 'required' => true], 'address' => ['enabled' => true, 'required' => true]], 'custom_fields' => []], true, 'card'),
    ])->published()->create(['slug' => 'guide', 'product_id' => $product->id]));
    $body = fn (array $customer) => ['host' => DG_HOST, 'slug' => 'guide', 'quantity' => 1, 'payment_method' => (string) $this->wallet->id, 'customer' => $customer, 'form_token' => app(FormToken::class)->issue($page->id, time() - 10)];

    $this->postJson('/api/v1/public/orders', $body(['name' => 'أحمد علي', 'phone' => '01012345678']), internalHeaders())->assertStatus(422)->assertJsonValidationErrors(['customer.email']);
    $this->postJson('/api/v1/public/orders', $body(['name' => 'أحمد علي', 'phone' => '01012345678', 'email' => 'ahmed@example.com']), internalHeaders())->assertCreated();

    expect(asTenant($this->tenant, fn () => Order::query()->sole()->customer_email))->toBe('ahmed@example.com');
});

it('keeps a product\'s files and codes to its store', function () {
    $product = dgProduct('codes');
    $this->postJson("/api/v1/dashboard/products/{$product->id}/codes", ['codes' => [['code' => 'SECRET-1']]])->assertCreated();

    Sanctum::actingAs(createOwner());
    $this->getJson("/api/v1/dashboard/products/{$product->id}/codes")->assertNotFound();
    $this->post("/api/v1/dashboard/products/{$product->id}/files", ['name' => 'x', 'file' => UploadedFile::fake()->create('a.pdf', 10, 'application/pdf')], ['Accept' => 'application/json'])->assertNotFound();
    app('auth')->forgetGuards();
    $this->withHeaders(['Authorization' => ''])->getJson("/api/v1/dashboard/products/{$product->id}/codes")->assertUnauthorized();
});
