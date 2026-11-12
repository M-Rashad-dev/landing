<?php

declare(strict_types=1);

use App\Billing\SubscriptionManager;
use App\Billing\Themes\ThemeCatalog;
use App\Models\AdminAuditLog;
use App\Models\Domain;
use App\Models\Identity;
use App\Models\Invoice;
use App\Models\LandingPage;
use App\Models\Payment;
use App\Models\PaymentMethod;
use App\Models\Product;
use App\Models\Tenant;
use App\Models\Theme;
use App\Models\ThemeImage;
use App\Models\ThemePurchase;
use App\Models\ThemeTag;
use App\Models\User;
use Database\Factories\LandingPageFactory;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;

function themeOwner(string $plan = 'pro'): User
{
    $tenant = Tenant::factory()->onPlan($plan)->create();
    $user = User::factory()->for($tenant)->create();
    asTenant($tenant, fn () => Identity::factory()->default()->create());
    Sanctum::actingAs($user->fresh(['tenant']));

    return $user;
}

function themeAdmin(): User
{
    $admin = User::factory()->superAdmin()->create();
    Sanctum::actingAs($admin);

    return $admin;
}

function themedPage(Tenant $tenant, string $theme, string $host): LandingPage
{
    Domain::factory()->for($tenant)->create(['host' => $host, 'active_host' => $host]);

    return asTenant($tenant, fn () => LandingPage::factory()
        ->withSections([LandingPageFactory::section('hero', ['title' => 'x'], true, 'split'), LandingPageFactory::section('order_form', [], true, 'card')])
        ->published()
        ->create([
            'slug' => 'offer', 'theme_key' => $theme, 'identity_id' => Identity::factory()->create()->id, 'product_id' => Product::factory()->create()->id,
            'published_content' => ['version' => 1, 'theme_key' => $theme, 'sections' => [LandingPageFactory::section('order_form', [], true, 'card')]],
        ]));
}

// --- the store's themes and the theme store -------------------------------------------------

it('needs a signed-in owner', function () {
    $this->getJson('/api/v1/dashboard/theme-store')->assertUnauthorized();
    $this->postJson('/api/v1/dashboard/billing/checkout/preview', ['type' => 'theme', 'theme_key' => 'celia'])->assertUnauthorized();
});

it('lists the store themes with what it owns and can publish', function () {
    $owner = themeOwner('basic');
    ownThemes($owner, 'layali');

    $rows = collect($this->getJson('/api/v1/dashboard/themes')->assertOk()->json('data'))->keyBy('key');

    expect($rows['malak']['owned'])->toBeTrue()->and($rows['malak']['can_publish'])->toBeTrue()->and($rows['malak']['is_free'])->toBeTrue()
        ->and($rows['celia']['owned'])->toBeFalse()->and($rows['celia']['price']['final'])->toEqual(100)
        // Owned on Basic: editable, not published (paid themes need Pro or Max).
        ->and($rows['layali']['owned'])->toBeTrue()->and($rows['layali']['can_publish'])->toBeFalse();
});

it('filters, searches and sorts the theme store, hiding unlisted themes', function () {
    themeOwner();
    Theme::query()->whereKey('layali')->update(['is_listed' => false]);
    ThemeCatalog::flush();

    $this->getJson('/api/v1/dashboard/theme-store')->assertOk()->assertJsonCount(3, 'data')->assertJsonPath('meta.tags.0.slug', 'general');
    $this->getJson('/api/v1/dashboard/theme-store?price=paid')->assertJsonCount(1, 'data');
    $this->getJson('/api/v1/dashboard/theme-store?price=paid&kind=landing')->assertJsonCount(1, 'data')->assertJsonPath('data.0.key', 'celia');
    $this->getJson('/api/v1/dashboard/theme-store?kind=store')->assertJsonCount(1, 'data')->assertJsonPath('data.0.key', 'asas');
    $this->getJson('/api/v1/dashboard/theme-store?tag=fashion')->assertJsonCount(1, 'data');
    $this->getJson('/api/v1/dashboard/theme-store?q='.urlencode('ملاك'))->assertJsonCount(1, 'data')->assertJsonPath('data.0.key', 'malak');
    $this->getJson('/api/v1/dashboard/theme-store?sort=price_desc')->assertJsonPath('data.0.key', 'celia');
    $this->getJson('/api/v1/dashboard/theme-store?sort=bad&kind=shop')->assertStatus(422)->assertJsonValidationErrors(['sort', 'kind']);
    $this->getJson('/api/v1/dashboard/theme-store/layali')->assertNotFound();
    $this->getJson('/api/v1/dashboard/theme-store/nope')->assertNotFound();
    $this->getJson('/api/v1/dashboard/theme-store/celia')->assertOk()->assertJsonPath('data.features.0', '16 قسم جاهز');
});

it('applies a theme discount inside its dates', function () {
    themeOwner();
    Theme::query()->whereKey('celia')->firstOrFail()->update(['discount_percent' => 20, 'discount_ends_at' => now()->addDay()]);

    $this->getJson('/api/v1/dashboard/theme-store/celia')->assertJsonPath('data.price.final', 80)->assertJsonPath('data.price.discount_percent', 20);
});

// --- buying -----------------------------------------------------------------------------------

it('refuses buying on Basic with the plan to upgrade to', function () {
    themeOwner('basic');

    $this->postJson('/api/v1/dashboard/billing/checkout/preview', ['type' => 'theme', 'theme_key' => 'celia'])->assertForbidden()->assertJsonPath('code', 'plan_feature_locked')->assertJsonPath('upgrade_to.key', 'pro');
});

it('respects a theme minimum plan', function () {
    themeOwner('pro');
    Theme::query()->whereKey('layali')->firstOrFail()->update(['min_plan_key' => 'max']);

    $this->postJson('/api/v1/dashboard/billing/checkout/preview', ['type' => 'theme', 'theme_key' => 'layali'])->assertForbidden()->assertJsonPath('upgrade_to.key', 'max');
});

it('shows what a theme costs without creating an invoice, and refuses owned themes', function () {
    themeOwner('pro');

    $this->postJson('/api/v1/dashboard/billing/checkout/preview', ['type' => 'theme', 'theme_key' => 'celia'])->assertOk()
        ->assertJsonPath('data.id', null)->assertJsonPath('data.type', 'theme')->assertJsonPath('data.theme.name', 'سيليا')->assertJsonPath('data.total', 100);

    expect(Invoice::query()->withoutGlobalScopes()->count())->toBe(0);
    $this->postJson('/api/v1/dashboard/billing/checkout/preview', ['type' => 'theme', 'theme_key' => 'malak'])->assertStatus(422)->assertJsonPath('code', 'theme_owned');
});

it('owns the theme forever once the admin approves the payment', function () {
    Storage::fake('local');
    PaymentMethod::query()->whereKey('instapay')->update(['is_active' => true, 'account_value' => 'x@instapay']);
    $owner = themeOwner('pro');
    $this->post('/api/v1/dashboard/billing/checkout', ['type' => 'theme', 'theme_key' => 'celia', 'method' => 'instapay', 'sender_ref' => 'TX-1', 'receipt' => UploadedFile::fake()->image('r.jpg', 300, 300)], ['Accept' => 'application/json'])
        ->assertCreated()->assertJsonPath('data.type', 'theme')->assertJsonPath('data.status', 'pending_review');
    $this->postJson('/api/v1/dashboard/billing/checkout/preview', ['type' => 'theme', 'theme_key' => 'celia'])->assertStatus(422)->assertJsonPath('code', 'invoice_pending_review');
    // A plan payment is not blocked by a theme receipt.
    $this->postJson('/api/v1/dashboard/billing/checkout/preview', ['type' => 'subscription', 'plan_key' => 'max', 'period' => 'monthly'])->assertOk();

    themeAdmin();
    $payment = Payment::query()->withoutGlobalScopes()->value('id');
    $this->getJson('/api/v1/admin/payments')->assertJsonPath('data.0.invoice.type', 'theme')->assertJsonPath('data.0.invoice.plan_name', 'سيليا');
    $this->postJson("/api/v1/admin/payments/{$payment}/approve")->assertOk();

    $purchase = asTenant($owner, fn () => ThemePurchase::query()->first());
    expect($purchase->theme_key)->toBe('celia')->and($purchase->source)->toBe('purchase')->and($purchase->price_paid)->toBe('100.00')
        ->and($owner->tenant->fresh()->plan_key)->toBe('pro');

    Sanctum::actingAs($owner->fresh(['tenant']));
    $this->getJson('/api/v1/dashboard/theme-store/celia')->assertJsonPath('data.owned', true)->assertJsonPath('data.can_publish', true)->assertJsonPath('data.sales', 1);
});

// --- using a theme --------------------------------------------------------------------------

it('refuses pages and switches to a paid theme the store does not own', function () {
    themeOwner('pro');
    $product = asTenant(auth()->user(), fn () => Product::factory()->create());

    $this->postJson('/api/v1/dashboard/pages', ['title' => 'x', 'slug' => 'paid-page', 'theme_key' => 'celia', 'product_id' => $product->id])
        ->assertStatus(422)->assertJsonPath('errors.theme_key.0', __('pages.theme_not_owned'));
    $id = $this->postJson('/api/v1/dashboard/pages', ['title' => 'y', 'slug' => 'free-page', 'theme_key' => 'malak', 'product_id' => $product->id])->assertCreated()->json('data.id');
    $this->putJson("/api/v1/dashboard/pages/{$id}/content", ['version' => 1, 'content' => ['version' => 1, 'sections' => []], 'theme_key' => 'celia'])->assertStatus(422)->assertJsonValidationErrors('theme_key');
});

it('lets Basic edit an owned paid theme but not publish or serve it', function () {
    $owner = themeOwner('basic');
    ownThemes($owner, 'celia');
    $page = themedPage($owner->tenant, 'celia', 'basic.localhost');

    $this->postJson("/api/v1/dashboard/pages/{$page->id}/publish")->assertStatus(422)->assertJsonFragment(['code' => 'theme_not_available']);
    $this->getJson('/api/v1/public/pages?host=basic.localhost&slug=offer', internalHeaders())->assertNotFound();

    // Upgrading brings it back.
    app(SubscriptionManager::class)->grant($owner->tenant, 'pro', 30, null, null);
    $this->getJson('/api/v1/public/pages?host=basic.localhost&slug=offer', internalHeaders())->assertOk();
});

it('never serves a paid theme the store does not own', function () {
    $tenant = Tenant::factory()->onPlan('max')->create();
    themedPage($tenant, 'layali', 'nope.localhost');

    $this->getJson('/api/v1/public/pages?host=nope.localhost&slug=offer', internalHeaders())->assertNotFound();
    $this->getJson('/api/v1/public/sitemap?host=nope.localhost', internalHeaders())->assertOk()->assertJsonCount(0, 'data.pages');
});

// --- admin --------------------------------------------------------------------------------

it('keeps the theme catalog to super admins', function () {
    themeOwner();
    $this->putJson('/api/v1/admin/themes/celia', [])->assertForbidden();
    $this->postJson('/api/v1/admin/tenants/1/themes', ['theme_key' => 'celia'])->assertForbidden();
});

it('edits the store details of a theme, with tags, and audits it', function () {
    themeAdmin();
    $tag = ThemeTag::query()->where('slug', 'beauty')->value('id');
    $body = [
        'name' => 'سيليا', 'kind' => 'landing', 'short_description' => 'جديد', 'description' => 'وصف', 'features' => ['أ', 'ب'],
        'price' => 120, 'discount_percent' => 25, 'discount_starts_at' => null, 'discount_ends_at' => null, 'min_plan_key' => null,
        'is_featured' => true, 'is_listed' => true, 'version' => '1.1', 'released_at' => null, 'tag_ids' => [$tag],
    ];

    $this->putJson('/api/v1/admin/themes/celia', ['price' => -1, 'discount_percent' => 95, 'kind' => 'x', 'tag_ids' => [999999]] + $body)
        ->assertStatus(422)->assertJsonValidationErrors(['price', 'discount_percent', 'kind', 'tag_ids.0']);
    $this->putJson('/api/v1/admin/themes/celia', $body)->assertOk()
        ->assertJsonPath('data.price.final', 90)->assertJsonPath('data.tags.0.slug', 'beauty')->assertJsonPath('data.is_featured', true);
    $this->putJson('/api/v1/admin/themes/nope', $body)->assertNotFound();

    expect(AdminAuditLog::query()->where('action', 'theme.update')->where('target_id', 'celia')->exists())->toBeTrue();
});

it('uploads, orders and deletes theme images', function () {
    Storage::fake('public');
    themeAdmin();

    $this->post('/api/v1/admin/themes/celia/images', ['image' => UploadedFile::fake()->image('a.png', 1200, 800), 'kind' => 'cover'], ['Accept' => 'application/json'])->assertOk();
    $this->post('/api/v1/admin/themes/celia/images', ['image' => UploadedFile::fake()->image('b.png', 400, 800), 'kind' => 'mobile'], ['Accept' => 'application/json'])->assertOk();
    $this->post('/api/v1/admin/themes/celia/images', ['image' => UploadedFile::fake()->create('x.pdf', 5, 'application/pdf'), 'kind' => 'cover'], ['Accept' => 'application/json'])->assertStatus(422);

    $ids = ThemeImage::query()->orderBy('id')->pluck('id')->all();
    $this->putJson('/api/v1/admin/themes/celia/images/order', ['ids' => array_reverse($ids)])->assertOk()->assertJsonPath('data.images.0.id', $ids[1]);
    $first = ThemeImage::query()->find($ids[0]);
    expect(Storage::disk('public')->exists($first->variants['large']))->toBeTrue();

    $this->deleteJson("/api/v1/admin/themes/celia/images/{$ids[0]}")->assertOk()->assertJsonCount(1, 'data.images');
    expect(Storage::disk('public')->exists($first->variants['large']))->toBeFalse();
    $this->deleteJson("/api/v1/admin/themes/malak/images/{$ids[1]}")->assertNotFound();
});

it('creates and deletes tags', function () {
    themeAdmin();

    $id = $this->postJson('/api/v1/admin/theme-tags', ['name' => 'أحذية'])->assertCreated()->json('data.id');
    $this->postJson('/api/v1/admin/theme-tags', ['name' => ''])->assertStatus(422);
    $this->deleteJson("/api/v1/admin/theme-tags/{$id}")->assertNoContent();
});

it('gives a paid theme to a store and takes back only its own gifts', function () {
    $tenant = Tenant::factory()->create();
    asTenant($tenant, fn () => ThemePurchase::query()->create(['theme_key' => 'layali', 'source' => 'purchase', 'price_paid' => 150]));
    themeAdmin();

    $this->postJson("/api/v1/admin/tenants/{$tenant->id}/themes", ['theme_key' => 'celia', 'note' => 'هدية'])->assertOk()->assertJsonCount(2, 'data');
    $this->postJson("/api/v1/admin/tenants/{$tenant->id}/themes", ['theme_key' => 'celia'])->assertStatus(422)->assertJsonPath('code', 'theme_owned');
    $this->deleteJson("/api/v1/admin/tenants/{$tenant->id}/themes/layali")->assertStatus(422)->assertJsonPath('code', 'theme_purchased');
    $this->deleteJson("/api/v1/admin/tenants/{$tenant->id}/themes/celia")->assertNoContent();

    expect(asTenant($tenant, fn () => ThemePurchase::query()->pluck('theme_key')->all()))->toBe(['layali'])
        ->and(AdminAuditLog::query()->whereIn('action', ['theme.grant', 'theme.revoke'])->count())->toBe(2);
});
