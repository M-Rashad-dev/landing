<?php

declare(strict_types=1);

use App\Models\CustomerUpload;
use App\Models\Domain;
use App\Models\Identity;
use App\Models\LandingPage;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Product;
use App\Models\ProductInput;
use App\Models\Store;
use App\Models\Tenant;
use App\Models\User;
use App\Services\FormToken;
use App\Store\CustomerUploads;
use Database\Factories\LandingPageFactory;
use Database\Seeders\ThemeSeeder;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Storage;
use Illuminate\Testing\TestResponse;
use Laravel\Sanctum\Sanctum;

const CI_HOST = 'custom.localhost';

beforeEach(function () {
    Mail::fake();
    Storage::fake('local');
    $this->seed(ThemeSeeder::class);
    $this->tenant = Tenant::factory()->onPlan('pro')->create();
    $this->owner = User::factory()->for($this->tenant)->create();
    Domain::factory()->for($this->tenant)->create(['host' => CI_HOST, 'active_host' => CI_HOST]);
    asTenant($this->tenant, fn () => Identity::factory()->default()->create());
    Sanctum::actingAs($this->owner->fresh(['tenant']));
});

/** A mug printed with the customer's name and photo: a required name (+10), an optional note, a required photo (+25). */
function ciProduct(): Product
{
    $id = test()->postJson('/api/v1/dashboard/products', [
        'name' => 'مج مطبوع',
        'price' => 150,
        'in_store' => true,
        'inputs' => [
            ['kind' => 'text', 'label' => 'الاسم على المج', 'placeholder' => 'مثلاً: أحمد', 'is_required' => true, 'price_delta' => 10],
            ['kind' => 'textarea', 'label' => 'ملاحظات', 'is_required' => false],
            ['kind' => 'image', 'label' => 'صورتك', 'is_required' => true, 'price_delta' => 25],
        ],
    ])->assertCreated()->json('data.id');

    return asTenant(test()->tenant, fn () => Product::query()->with('inputs')->findOrFail($id));
}

function ciInput(Product $product, string $kind): ProductInput
{
    return $product->inputs->firstWhere('kind.value', $kind);
}

function ciUpload(ProductInput $input, ?UploadedFile $file = null): TestResponse
{
    return test()->post('/api/v1/public/uploads', ['host' => CI_HOST, 'input_id' => $input->id, 'file' => $file ?? UploadedFile::fake()->image('me.jpg', 400, 400), 'ip' => '41.1.1.1'], internalHeaders() + ['Accept' => 'application/json']);
}

function ciStore(): Store
{
    test()->postJson('/api/v1/dashboard/store/setup')->assertOk();
    test()->postJson('/api/v1/dashboard/store/design/publish')->assertOk();
    test()->putJson('/api/v1/dashboard/store', ['is_enabled' => true])->assertOk();

    return asTenant(test()->tenant, fn () => Store::query()->firstOrFail());
}

function ciCheckout(Store $store, array $items): TestResponse
{
    return test()->postJson('/api/v1/public/store/orders', [
        'host' => CI_HOST,
        'items' => $items,
        'customer' => ['name' => 'سارة محمد', 'phone' => '01012345678', 'governorate' => 'القاهرة', 'address' => 'شارع 9'],
        'form_token' => app(FormToken::class)->issue('store:'.$store->id, time() - 10),
    ], internalHeaders());
}

it('saves «حسب الطلب» fields on a product, in order, and keeps ids on update', function () {
    $product = ciProduct();
    $this->getJson("/api/v1/dashboard/products/{$product->id}")->assertOk()
        ->assertJsonCount(3, 'data.inputs')
        ->assertJsonPath('data.inputs.0.label', 'الاسم على المج')
        ->assertJsonPath('data.inputs.0.price_delta', 10)
        ->assertJsonPath('data.inputs.2.kind', 'image');

    $name = ciInput($product, 'text');
    $this->putJson("/api/v1/dashboard/products/{$product->id}", ['name' => 'مج مطبوع', 'price' => 150, 'inputs' => [
        ['id' => $name->id, 'kind' => 'text', 'label' => 'الاسم', 'is_required' => true],
    ]])->assertOk()->assertJsonCount(1, 'data.inputs')->assertJsonPath('data.inputs.0.id', $name->id)->assertJsonPath('data.inputs.0.label', 'الاسم');
    expect(asTenant($this->tenant, fn () => ProductInput::query()->count()))->toBe(1);
});

it('validates the fields', function () {
    $this->postJson('/api/v1/dashboard/products', ['name' => 'x', 'price' => 10, 'inputs' => [
        ['kind' => 'video', 'label' => 'a'],
        ['kind' => 'text', 'label' => '', 'price_delta' => -5],
    ]])->assertStatus(422)->assertJsonValidationErrors(['inputs.0.kind', 'inputs.1.label', 'inputs.1.price_delta']);
    $this->postJson('/api/v1/dashboard/products', ['name' => 'x', 'price' => 10, 'inputs' => [
        ['kind' => 'text', 'label' => 'الاسم'], ['kind' => 'textarea', 'label' => 'الاسم'],
    ]])->assertStatus(422)->assertJsonValidationErrors(['inputs.1.label']);
    $this->postJson('/api/v1/dashboard/products', ['name' => 'x', 'price' => 10, 'inputs' => array_fill(0, 6, ['kind' => 'text', 'label' => 'a'])])
        ->assertStatus(422)->assertJsonValidationErrors(['inputs']);

    // Another product's field id can't be taken over.
    $product = ciProduct();
    $other = $this->postJson('/api/v1/dashboard/products', ['name' => 'y', 'price' => 10])->json('data.id');
    $this->putJson("/api/v1/dashboard/products/{$other}", ['name' => 'y', 'price' => 10, 'inputs' => [['id' => ciInput($product, 'text')->id, 'kind' => 'text', 'label' => 'z']]])
        ->assertStatus(422)->assertJsonValidationErrors(['inputs.0.id']);
});

it('takes a customer\'s photo for an image field and keeps it private', function () {
    $product = ciProduct();
    $photo = ciInput($product, 'image');

    ciUpload($photo, UploadedFile::fake()->create('cv.pdf', 100, 'application/pdf'))->assertStatus(422)->assertJsonValidationErrors(['file']);
    ciUpload($photo, UploadedFile::fake()->image('big.jpg')->size(CustomerUploads::MAX_KB + 1))->assertStatus(422)->assertJsonValidationErrors(['file']);
    ciUpload(ciInput($product, 'text'))->assertStatus(422)->assertJsonValidationErrors(['input_id']);
    $this->post('/api/v1/public/uploads', ['host' => CI_HOST, 'input_id' => $photo->id, 'file' => UploadedFile::fake()->image('a.jpg')], ['Accept' => 'application/json'])->assertUnauthorized();

    $token = ciUpload($photo)->assertCreated()->assertJsonPath('data.name', 'me.jpg')->json('data.token');
    expect($token)->toMatch(CustomerUploads::TOKEN);
    $upload = asTenant($this->tenant, fn () => CustomerUpload::query()->sole());
    expect($upload->order_item_id)->toBeNull()->and($upload->path)->toStartWith('customer-uploads/'.$this->tenant->id.'/');
    Storage::disk('local')->assertExists($upload->path);

    // A file field takes documents too.
    $this->putJson("/api/v1/dashboard/products/{$product->id}", ['name' => 'مج', 'price' => 150, 'inputs' => [['kind' => 'file', 'label' => 'التصميم']]])->assertOk();
    $file = asTenant($this->tenant, fn () => ProductInput::query()->sole());
    ciUpload($file, UploadedFile::fake()->create('design.pdf', 300, 'application/pdf'))->assertCreated();
});

it('never takes uploads for another store\'s field', function () {
    $product = ciProduct();
    $other = Tenant::factory()->create();
    Domain::factory()->for($other)->create(['host' => 'other.localhost', 'active_host' => 'other.localhost']);

    $this->post('/api/v1/public/uploads', ['host' => 'other.localhost', 'input_id' => ciInput($product, 'image')->id, 'file' => UploadedFile::fake()->image('a.jpg')], internalHeaders() + ['Accept' => 'application/json'])
        ->assertNotFound();
    expect(asTenant($this->tenant, fn () => CustomerUpload::query()->count()))->toBe(0);
});

it('orders a custom product from the store: fields priced, checked and kept on the line, the photo claimed once', function () {
    $store = ciStore();
    $product = ciProduct();
    $name = ciInput($product, 'text');
    $photo = ciInput($product, 'image');

    $this->getJson('/api/v1/public/store/products/'.$product->slug.'?host='.CI_HOST, internalHeaders())->assertOk()
        ->assertJsonCount(3, 'data.product.inputs')
        ->assertJsonPath('data.product.inputs.2.kind', 'image');

    ciCheckout($store, [['product_id' => $product->id, 'quantity' => 1]])->assertStatus(422)
        ->assertJsonValidationErrors(["items.0.inputs.{$name->id}", "items.0.inputs.{$photo->id}"]);
    ciCheckout($store, [['product_id' => $product->id, 'quantity' => 1, 'inputs' => [$name->id => str_repeat('ا', 201), $photo->id => 'x']]])->assertStatus(422)
        ->assertJsonValidationErrors(["items.0.inputs.{$name->id}", "items.0.inputs.{$photo->id}"]);
    ciCheckout($store, [['product_id' => $product->id, 'quantity' => 1, 'inputs' => [$name->id => 'أحمد', $photo->id => str_repeat('a', 40)]]])->assertStatus(422)
        ->assertJsonValidationErrors(["items.0.inputs.{$photo->id}"]);

    $token = ciUpload($photo)->json('data.token');
    // 150 + 10 (name) + 25 (photo) = 185 × 2
    $this->postJson('/api/v1/public/store/quote', ['host' => CI_HOST, 'items' => [['product_id' => $product->id, 'quantity' => 2, 'inputs' => [$name->id => 'أحمد', $photo->id => $token]]]], internalHeaders())
        ->assertOk()->assertJsonPath('data.subtotal', 370);
    ciCheckout($store, [['product_id' => $product->id, 'quantity' => 2, 'inputs' => [$name->id => '  أحمد  ', $photo->id => $token]]])->assertCreated();

    $item = asTenant($this->tenant, fn () => OrderItem::query()->sole());
    $upload = asTenant($this->tenant, fn () => CustomerUpload::query()->sole());
    expect((string) $item->unit_price)->toBe('185.00')
        ->and($item->options)->toBe([
            ['option' => 'الاسم على المج', 'value' => 'أحمد', 'price_delta' => 10, 'input_id' => $name->id, 'kind' => 'text'],
            ['option' => 'صورتك', 'value' => 'me.jpg', 'price_delta' => 25, 'input_id' => $photo->id, 'kind' => 'image', 'upload_id' => $upload->id],
        ])
        ->and($upload->order_item_id)->toBe($item->id);

    // The same photo can't go with a second order.
    ciCheckout($store, [['product_id' => $product->id, 'quantity' => 1, 'inputs' => [$name->id => 'منى', $photo->id => $token]]])->assertStatus(422)
        ->assertJsonValidationErrors(["items.0.inputs.{$photo->id}"]);

    // The order page shows the fields; the photo downloads for the store only.
    $order = asTenant($this->tenant, fn () => Order::query()->sole());
    $this->getJson("/api/v1/dashboard/orders/{$order->id}")->assertOk()->assertJsonPath('data.items.0.options.1.upload_id', $upload->id);
    $this->get("/api/v1/dashboard/orders/{$order->id}/uploads/{$upload->id}")->assertOk()
        ->assertHeader('X-Content-Type-Options', 'nosniff')
        ->assertDownload('me.jpg');

    Sanctum::actingAs(createOwner());
    $this->getJson("/api/v1/dashboard/orders/{$order->id}/uploads/{$upload->id}")->assertNotFound();
    app('auth')->forgetGuards();
    $this->withHeaders(['Authorization' => ''])->getJson("/api/v1/dashboard/orders/{$order->id}/uploads/{$upload->id}")->assertUnauthorized();
});

it('takes the fields on a landing page order too', function () {
    $product = ciProduct();
    asTenant($this->tenant, fn () => LandingPage::factory()->withSections([
        LandingPageFactory::section('hero', ['title' => 'x'], true, 'split'),
        LandingPageFactory::section('order_form', ['fields' => ['name' => ['enabled' => true, 'required' => true], 'phone' => ['enabled' => true, 'required' => true], 'governorate' => ['enabled' => true, 'required' => true], 'address' => ['enabled' => true, 'required' => true]], 'custom_fields' => []], true, 'card'),
    ])->published()->create(['slug' => 'mug', 'product_id' => $product->id]));
    $page = asTenant($this->tenant, fn () => LandingPage::query()->where('slug', 'mug')->firstOrFail());
    $name = ciInput($product, 'text');
    $photo = ciInput($product, 'image');
    $token = ciUpload($photo)->json('data.token');
    $body = fn (array $inputs) => [
        'host' => CI_HOST, 'slug' => 'mug', 'quantity' => 1, 'inputs' => $inputs,
        'customer' => ['name' => 'أحمد علي', 'phone' => '01012345678', 'governorate' => 'القاهرة', 'address' => 'شارع النصر 10'],
        'form_token' => app(FormToken::class)->issue($page->id, time() - 10),
    ];

    $this->postJson('/api/v1/public/quote', ['host' => CI_HOST, 'slug' => 'mug', 'quantity' => 1, 'inputs' => [$name->id => 'أحمد', $photo->id => $token]], internalHeaders())
        ->assertOk()->assertJsonPath('data.unit_price', 185);
    $this->postJson('/api/v1/public/orders', $body([$name->id => 'أحمد']), internalHeaders())->assertStatus(422)->assertJsonValidationErrors(["inputs.{$photo->id}"]);
    $this->postJson('/api/v1/public/orders', $body([$name->id => 'أحمد', $photo->id => $token]), internalHeaders())->assertCreated();

    $item = asTenant($this->tenant, fn () => OrderItem::query()->sole());
    expect($item->options[1]['value'])->toBe('me.jpg')
        ->and(asTenant($this->tenant, fn () => CustomerUpload::query()->sole()->order_item_id))->toBe($item->id);
});

it('sends products with required fields to their page instead of a quick add, a gift or a one-click upsell', function () {
    ciStore();
    $product = ciProduct();

    expect(asTenant($this->tenant, fn () => Product::query()->with(['options', 'inputs'])->find($product->id)->needsChoices()))->toBeTrue();
    $this->getJson('/api/v1/public/store/products?host='.CI_HOST, internalHeaders())->assertOk()->assertJsonPath('data.0.needs_options', true);
});

it('deletes uploads no order took within a day', function () {
    $product = ciProduct();
    $photo = ciInput($product, 'image');
    ciUpload($photo);
    ciUpload($photo);
    [$old, $kept] = asTenant($this->tenant, fn () => CustomerUpload::query()->orderBy('id')->get()->all());
    asTenant($this->tenant, function () use ($old, $kept): void {
        $old->forceFill(['created_at' => now()->subDays(2)])->save();
        $kept->forceFill(['created_at' => now()->subDays(2), 'order_item_id' => null])->save();
    });
    // The second one went with an order.
    $order = asTenant($this->tenant, fn () => Order::factory()->create());
    $item = asTenant($this->tenant, fn () => $order->items()->create(['product_id' => $product->id, 'product_name' => 'مج', 'unit_price' => '150.00', 'quantity' => 1, 'line_total' => '150.00']));
    asTenant($this->tenant, fn () => $kept->forceFill(['order_item_id' => $item->id])->save());

    $this->artisan('uploads:prune')->assertSuccessful();

    expect(asTenant($this->tenant, fn () => CustomerUpload::query()->pluck('id')->all()))->toBe([$kept->id]);
    Storage::disk('local')->assertMissing($old->path);
    Storage::disk('local')->assertExists($kept->path);
});
