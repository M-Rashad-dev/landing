<?php

declare(strict_types=1);

use App\Enums\BlockType;
use App\Enums\LeadStatus;
use App\Models\AbandonedLead;
use App\Models\BlockedCustomer;
use App\Models\Domain;
use App\Models\LandingPage;
use App\Models\Order;
use App\Models\Product;
use App\Services\FormToken;
use Database\Factories\LandingPageFactory;
use Database\Seeders\ThemeSeeder;
use Illuminate\Testing\TestResponse;

const LEAD_SHOP = 'leads.localhost';

beforeEach(function () {
    $this->seed(ThemeSeeder::class);
    $this->owner = createOwner();
    $this->tenant = $this->owner->tenant;
    Domain::factory()->for($this->tenant)->create(['host' => LEAD_SHOP, 'active_host' => LEAD_SHOP]);
    $this->product = asTenant($this->tenant, fn () => Product::factory()->create(['name' => 'ساعة', 'price' => '400.00']));
    $this->page = asTenant($this->tenant, fn () => LandingPage::factory()
        ->withSections([LandingPageFactory::section('order_form', [
            'fields' => [
                'name' => ['enabled' => true, 'required' => true],
                'phone' => ['enabled' => true, 'required' => true],
                'phone2' => ['enabled' => false, 'required' => false],
                'governorate' => ['enabled' => true, 'required' => true],
                'city' => ['enabled' => false, 'required' => false],
                'address' => ['enabled' => true, 'required' => true],
                'notes' => ['enabled' => false, 'required' => false],
            ],
            'custom_fields' => [],
        ], true, 'card')])
        ->published()
        ->create(['slug' => 'watch', 'title' => 'صفحة الساعة', 'product_id' => $this->product->id]));
});

function sendLead(array $overrides = []): TestResponse
{
    return test()->postJson('/api/v1/public/leads', array_merge([
        'host' => LEAD_SHOP,
        'slug' => 'watch',
        'phone' => '0100 123 4567',
        'name' => 'منى',
        'governorate' => 'الجيزة',
        'quantity' => 2,
        'form_token' => app(FormToken::class)->issue(test()->page->id, time() - 10),
        'ip' => '41.20.20.20',
    ], $overrides), internalHeaders());
}

function leads(): array
{
    return asTenant(test()->tenant, fn () => AbandonedLead::query()->orderBy('id')->get()->all());
}

it('captures one open lead per phone and page, updating it as the visitor types', function () {
    sendLead()->assertStatus(202)->assertJsonPath('data.received', true);
    sendLead(['name' => 'منى أحمد', 'governorate' => null, 'quantity' => 3])->assertStatus(202);

    $all = leads();
    expect($all)->toHaveCount(1)
        ->and($all[0]->customer_phone)->toBe('+201001234567')
        ->and($all[0]->customer_name)->toBe('منى أحمد')
        ->and($all[0]->governorate)->toBe('الجيزة')
        ->and($all[0]->quantity)->toBe(3)
        ->and($all[0]->status)->toBe(LeadStatus::Open)
        ->and($all[0]->product_id)->toBe($this->product->id);
});

it('drops bad phones, bad tokens, blocked visitors and recent buyers silently', function () {
    sendLead(['phone' => '12345'])->assertStatus(202);
    sendLead(['form_token' => 'nope'])->assertStatus(202);
    sendLead(['form_token' => app(FormToken::class)->issue($this->page->id + 1, time() - 10)])->assertStatus(202);

    asTenant($this->tenant, fn () => BlockedCustomer::query()->create(['type' => BlockType::Phone, 'value' => '+201001234567']));
    sendLead()->assertStatus(202);

    asTenant($this->tenant, fn () => Order::factory()->create(['customer_phone' => '+201112223334', 'landing_page_id' => $this->page->id]));
    sendLead(['phone' => '01112223334'])->assertStatus(202);

    expect(leads())->toBeEmpty();
});

it('validates input, needs the internal key and an existing page', function () {
    $this->postJson('/api/v1/public/leads', [], internalHeaders())->assertStatus(422)->assertJsonValidationErrors(['host', 'phone', 'form_token']);
    sendLead(['quantity' => 99])->assertStatus(422)->assertJsonValidationErrors(['quantity']);
    $this->postJson('/api/v1/public/leads', ['host' => LEAD_SHOP, 'slug' => 'watch', 'phone' => '01001234567', 'form_token' => 'x'])->assertUnauthorized();
    sendLead(['slug' => 'missing'])->assertNotFound();
    sendLead(['host' => 'unknown.localhost'])->assertNotFound();
});

it('marks the lead converted when that phone orders', function () {
    sendLead()->assertStatus(202);

    $this->postJson('/api/v1/public/orders', [
        'host' => LEAD_SHOP,
        'slug' => 'watch',
        'quantity' => 1,
        'options' => [],
        'customer' => ['name' => 'منى', 'phone' => '01001234567', 'governorate' => 'الجيزة', 'address' => 'شارع الهرم 5'],
        'answers' => [],
        'form_token' => app(FormToken::class)->issue($this->page->id, time() - 10),
        'website' => '',
        'ip' => '41.20.20.20',
    ], internalHeaders())->assertCreated();

    $lead = leads()[0];
    expect($lead->status)->toBe(LeadStatus::Converted)
        ->and($lead->order_id)->not->toBeNull();
});

it('lists leads by status with counts and lets the owner mark them', function () {
    sendLead()->assertStatus(202);
    sendLead(['phone' => '01223334445', 'name' => 'كريم'])->assertStatus(202);
    actingAsOwner($this->owner);

    $response = $this->getJson('/api/v1/dashboard/leads')->assertOk()
        ->assertJsonCount(2, 'data')
        ->assertJsonPath('data.0.customer_name', 'كريم')
        ->assertJsonPath('data.0.page.title', 'صفحة الساعة')
        ->assertJsonPath('data.0.product.name', 'ساعة')
        ->assertJsonPath('meta.counts.open', 2);
    $id = $response->json('data.0.id');

    $this->patchJson("/api/v1/dashboard/leads/{$id}", ['status' => 'contacted'])->assertOk()
        ->assertJsonPath('data.status', 'contacted')
        ->assertJsonPath('data.contacted_at', fn ($value) => $value !== null);
    $this->getJson('/api/v1/dashboard/leads?status=contacted')->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('meta.counts.open', 1)->assertJsonPath('meta.counts.contacted', 1);

    $this->patchJson("/api/v1/dashboard/leads/{$id}", ['status' => 'converted'])->assertStatus(422)->assertJsonValidationErrors(['status']);
    $this->deleteJson("/api/v1/dashboard/leads/{$id}")->assertNoContent();
    expect(leads())->toHaveCount(1);
});

it('never changes a converted lead back', function () {
    sendLead()->assertStatus(202);
    $lead = leads()[0];
    asTenant($this->tenant, fn () => $lead->update(['status' => LeadStatus::Converted]));
    actingAsOwner($this->owner);

    $this->patchJson("/api/v1/dashboard/leads/{$lead->id}", ['status' => 'dismissed'])->assertOk()->assertJsonPath('data.status', 'converted');
});

it('keeps leads per store and needs a token', function () {
    sendLead()->assertStatus(202);
    $id = leads()[0]->id;

    $this->getJson('/api/v1/dashboard/leads')->assertUnauthorized();

    actingAsOwner(createOwner());
    $this->getJson('/api/v1/dashboard/leads')->assertOk()->assertJsonCount(0, 'data');
    $this->patchJson("/api/v1/dashboard/leads/{$id}", ['status' => 'dismissed'])->assertNotFound();
    $this->deleteJson("/api/v1/dashboard/leads/{$id}")->assertNotFound();
});

it('prunes leads older than 30 days across stores', function () {
    sendLead()->assertStatus(202);
    sendLead(['phone' => '01223334445'])->assertStatus(202);
    asTenant($this->tenant, fn () => AbandonedLead::query()->orderBy('id')->first()->forceFill(['created_at' => now()->subDays(31)])->save());

    $this->artisan('leads:prune')->assertSuccessful();

    expect(leads())->toHaveCount(1);
});
