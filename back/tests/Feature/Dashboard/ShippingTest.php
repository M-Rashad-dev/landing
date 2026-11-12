<?php

declare(strict_types=1);

use App\Jobs\RevalidateTenantHosts;
use App\Models\Category;
use App\Models\Product;
use App\Models\ShippingCompany;
use App\Models\ShippingCompanyRate;
use App\Models\ShippingOffer;
use Illuminate\Support\Facades\Queue;

beforeEach(function () {
    $this->user = actingAsOwner();
});

function companyPayload(array $overrides = []): array
{
    return array_replace(['name' => 'بوسطة', 'default_fee' => 50, 'delivery_days_min' => 2, 'delivery_days_max' => 4, 'rates' => []], $overrides);
}

it('starts with shipping off and no company, and needs an active company to switch on', function () {
    $this->getJson('/api/v1/dashboard/shipping')->assertOk()
        ->assertJsonPath('data.enabled', false)
        ->assertJsonPath('data.companies', [])
        ->assertJsonCount(count(config('landing.governorates')), 'data.governorates');

    $this->putJson('/api/v1/dashboard/shipping', ['enabled' => true])->assertStatus(422)->assertJsonValidationErrors(['enabled']);

    $this->postJson('/api/v1/dashboard/shipping-companies', companyPayload())->assertCreated();
    $this->putJson('/api/v1/dashboard/shipping', ['enabled' => true])->assertOk()->assertJsonPath('data.enabled', true)->assertJsonCount(1, 'data.companies');
});

it('saves a company with only the governorates that differ, and revalidates the site', function () {
    Queue::fake();
    $id = $this->postJson('/api/v1/dashboard/shipping-companies', companyPayload(['rates' => [
        ['governorate' => 'أسوان', 'fee' => 80, 'is_available' => true],
        ['governorate' => 'شمال سيناء', 'fee' => 99, 'is_available' => false],
        ['governorate' => 'القاهرة', 'fee' => null, 'is_available' => true],
    ]]))->assertCreated()
        ->assertJsonPath('data.default_fee', 50)
        ->assertJsonPath('data.delivery_days_max', 4)
        ->assertJsonPath('data.served_count', count(config('landing.governorates')) - 1)
        ->json('data.id');

    $rates = asTenant($this->user, fn () => ShippingCompanyRate::query()->orderBy('governorate')->get(['governorate', 'fee', 'is_available'])->toArray());
    expect($rates)->toBe([
        ['governorate' => 'أسوان', 'fee' => '80.00', 'is_available' => true],
        ['governorate' => 'شمال سيناء', 'fee' => null, 'is_available' => false],
    ]);
    Queue::assertPushed(RevalidateTenantHosts::class);

    // Editing replaces the rows; back to the default removes them.
    $this->putJson("/api/v1/dashboard/shipping-companies/{$id}", companyPayload(['name' => 'بوسطة إكسبريس', 'rates' => [['governorate' => 'أسوان', 'fee' => null, 'is_available' => true]]]))
        ->assertOk()->assertJsonPath('data.name', 'بوسطة إكسبريس');
    expect(asTenant($this->user, fn () => ShippingCompanyRate::query()->count()))->toBe(0);
});

it('validates a company', function () {
    $this->postJson('/api/v1/dashboard/shipping-companies', ['name' => '', 'default_fee' => -1, 'delivery_days_min' => 5, 'delivery_days_max' => 99, 'rates' => [['governorate' => 'باريس', 'fee' => 'x', 'is_available' => 'maybe']]])
        ->assertStatus(422)
        ->assertJsonValidationErrors(['name', 'default_fee', 'delivery_days_max', 'rates.0.governorate', 'rates.0.fee', 'rates.0.is_available']);
    $this->postJson('/api/v1/dashboard/shipping-companies', companyPayload(['delivery_days_min' => 5, 'delivery_days_max' => 2]))
        ->assertStatus(422)->assertJsonValidationErrors(['delivery_days_max']);
});

it('keeps one active company while shipping is on, and reorders', function () {
    $a = $this->postJson('/api/v1/dashboard/shipping-companies', companyPayload())->json('data.id');
    $b = $this->postJson('/api/v1/dashboard/shipping-companies', companyPayload(['name' => 'أرامكس']))->json('data.id');
    $this->putJson('/api/v1/dashboard/shipping', ['enabled' => true])->assertOk();

    $this->postJson("/api/v1/dashboard/shipping-companies/{$a}/toggle")->assertOk()->assertJsonPath('data.is_active', false);
    $this->postJson("/api/v1/dashboard/shipping-companies/{$b}/toggle")->assertStatus(422)->assertJsonPath('code', 'last_company');
    $this->deleteJson("/api/v1/dashboard/shipping-companies/{$b}")->assertStatus(422);
    $this->putJson("/api/v1/dashboard/shipping-companies/{$b}", companyPayload(['is_active' => false]))->assertStatus(422);
    // An inactive one can go.
    $this->deleteJson("/api/v1/dashboard/shipping-companies/{$a}")->assertNoContent();

    $c = $this->postJson('/api/v1/dashboard/shipping-companies', companyPayload(['name' => 'جي آند تي']))->json('data.id');
    $this->putJson('/api/v1/dashboard/shipping-companies/order', ['ids' => [$c, $b]])->assertNoContent();
    $this->getJson('/api/v1/dashboard/shipping')->assertJsonPath('data.companies.0.id', $c)->assertJsonPath('data.companies.1.id', $b);
});

it('creates, filters, edits, switches off and deletes shipping offers', function () {
    [$product, $category] = asTenant($this->user, fn () => [Product::factory()->create(), Category::query()->create(['name' => 'أحذية', 'slug' => 'shoes'])]);
    $company = $this->postJson('/api/v1/dashboard/shipping-companies', companyPayload())->json('data.id');

    $id = $this->postJson('/api/v1/dashboard/shipping-offers', [
        'name' => 'اشتري 3 والشحن مجاني',
        'benefit' => 'free',
        'min_quantity' => 3,
        'applies_to' => 'products',
        'product_ids' => [$product->id],
        'governorates' => ['القاهرة', 'الجيزة'],
        'company_ids' => [$company],
    ])->assertCreated()
        ->assertJsonPath('data.status', 'active')
        ->assertJsonPath('data.product_ids', [$product->id])
        ->assertJsonPath('data.governorates', ['القاهرة', 'الجيزة'])
        ->json('data.id');

    $this->putJson("/api/v1/dashboard/shipping-offers/{$id}", ['name' => 'شحن بـ 20 للأحذية', 'benefit' => 'flat', 'value' => 20, 'applies_to' => 'categories', 'category_ids' => [$category->id]])
        ->assertOk()->assertJsonPath('data.value', 20)->assertJsonPath('data.product_ids', [])->assertJsonPath('data.category_ids', [$category->id])
        ->assertJsonPath('data.governorates', []);

    $this->getJson('/api/v1/dashboard/shipping-offers?q=أحذية')->assertJsonCount(1, 'data');
    $this->postJson("/api/v1/dashboard/shipping-offers/{$id}/toggle")->assertJsonPath('data.status', 'inactive');
    $this->getJson('/api/v1/dashboard/shipping-offers?status=active')->assertJsonCount(0, 'data');
    $this->deleteJson("/api/v1/dashboard/shipping-offers/{$id}")->assertNoContent();
    expect(asTenant($this->user, fn () => ShippingOffer::query()->count()))->toBe(0);
});

it('validates shipping offers', function () {
    $this->postJson('/api/v1/dashboard/shipping-offers', ['name' => '', 'benefit' => 'cheap'])->assertStatus(422)->assertJsonValidationErrors(['name', 'benefit']);
    $this->postJson('/api/v1/dashboard/shipping-offers', ['name' => 'x', 'benefit' => 'discount', 'min_quantity' => 0, 'applies_to' => 'products', 'governorates' => ['باريس'], 'company_ids' => [999999]])
        ->assertStatus(422)->assertJsonValidationErrors(['value', 'min_quantity', 'product_ids', 'governorates.0', 'company_ids.0']);
    $this->postJson('/api/v1/dashboard/shipping-offers', ['name' => 'x', 'benefit' => 'free', 'applies_to' => 'categories', 'starts_at' => '2026-12-10T10:00', 'ends_at' => '2026-12-01T10:00'])
        ->assertStatus(422)->assertJsonValidationErrors(['category_ids']);
    $this->postJson('/api/v1/dashboard/shipping-offers', ['name' => 'x', 'benefit' => 'free', 'starts_at' => '2026-12-10T10:00', 'ends_at' => '2026-12-01T10:00'])
        ->assertStatus(422)->assertJsonValidationErrors(['ends_at']);
});

it('keeps each store’s shipping apart and needs a token', function () {
    $company = $this->postJson('/api/v1/dashboard/shipping-companies', companyPayload())->json('data.id');
    $offer = $this->postJson('/api/v1/dashboard/shipping-offers', ['name' => 'مجاني', 'benefit' => 'free'])->json('data.id');
    $product = asTenant($this->user, fn () => Product::factory()->create());

    actingAsOwner(createOwner());
    $this->getJson('/api/v1/dashboard/shipping')->assertJsonPath('data.companies', []);
    $this->getJson("/api/v1/dashboard/shipping-companies/{$company}")->assertNotFound();
    $this->putJson("/api/v1/dashboard/shipping-companies/{$company}", companyPayload())->assertNotFound();
    $this->deleteJson("/api/v1/dashboard/shipping-companies/{$company}")->assertNotFound();
    $this->getJson("/api/v1/dashboard/shipping-offers/{$offer}")->assertNotFound();
    $this->getJson('/api/v1/dashboard/shipping-offers')->assertJsonCount(0, 'data');
    // Another store's ids are refused inside a payload too.
    $this->postJson('/api/v1/dashboard/shipping-offers', ['name' => 'x', 'benefit' => 'free', 'applies_to' => 'products', 'product_ids' => [$product->id], 'company_ids' => [$company]])
        ->assertStatus(422)->assertJsonValidationErrors(['product_ids.0', 'company_ids.0']);
    $this->putJson('/api/v1/dashboard/shipping-companies/order', ['ids' => [$company]])->assertStatus(422);
    expect(asTenant($this->user, fn () => ShippingCompany::query()->count()))->toBe(1);

    app('auth')->forgetGuards();
    $this->getJson('/api/v1/dashboard/shipping')->assertUnauthorized();
    $this->putJson('/api/v1/dashboard/shipping', [])->assertUnauthorized();
    $this->postJson('/api/v1/dashboard/shipping-companies', [])->assertUnauthorized();
    $this->getJson('/api/v1/dashboard/shipping-offers')->assertUnauthorized();
});
