<?php

declare(strict_types=1);

use App\Models\AdminAuditLog;
use App\Models\Customer;
use App\Models\Domain;
use App\Models\Identity;
use App\Models\LandingPage;
use App\Models\Media;
use App\Models\Order;
use App\Models\OutboundMessage;
use App\Models\Product;
use App\Models\Tenant;
use App\Models\Theme;
use App\Models\ThemePurchase;
use App\Models\User;
use App\Models\UserNotification;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\PersonalAccessToken;
use Laravel\Sanctum\Sanctum;

/** A store with a bit of everything: pages on its products, orders, customers, a theme it bought, files, messages. */
function storeToDelete(string $name): Tenant
{
    $tenant = Tenant::factory()->create(['name' => $name]);
    $owner = User::factory()->for($tenant)->create();
    Domain::factory()->for($tenant)->create();
    $owner->createToken('dashboard');
    asTenant($tenant, function () use ($tenant, $owner) {
        $identity = Identity::factory()->default()->create();
        $product = Product::factory()->create();
        Media::factory()->create();
        LandingPage::factory()->published()->create(['identity_id' => $identity->id, 'product_id' => $product->id]);
        $customer = Customer::query()->create(['name' => 'سارة', 'phone' => '+2010'.random_int(10000000, 99999999)]);
        Order::factory()->create(['customer_id' => $customer->id]);
        ThemePurchase::query()->create(['theme_key' => 'sufi_store', 'source' => 'admin_grant', 'price_paid' => 0]);
        UserNotification::query()->create(['user_id' => $owner->id, 'tenant_id' => $tenant->id, 'event' => 'new_order', 'title' => 'طلب', 'body' => 'طلب جديد']);
        OutboundMessage::query()->create(['tenant_id' => $tenant->id, 'channel' => 'whatsapp', 'recipient' => '201000000000', 'purpose' => 'order_received', 'status' => 'sent']);
    });
    Storage::disk('public')->put("tenants/{$tenant->id}/2026/11/a.webp", 'x');
    Storage::disk('local')->put("receipts/{$tenant->id}/2026/11/r.webp", 'x');
    Storage::disk('local')->put("support/{$tenant->id}/1/f.pdf", 'x');

    return $tenant;
}

beforeEach(function () {
    Storage::fake('public');
    Storage::fake('local');
});

it('needs the platform admin', function () {
    $tenant = storeToDelete('متجر تجربة');
    $this->deleteJson("/api/v1/admin/tenants/{$tenant->id}", ['confirm' => 'متجر تجربة'])->assertUnauthorized();

    Sanctum::actingAs(createOwner());
    $this->deleteJson("/api/v1/admin/tenants/{$tenant->id}", ['confirm' => 'متجر تجربة'])->assertForbidden();
    $this->getJson("/api/v1/admin/tenants/{$tenant->id}/deletion")->assertForbidden();
    expect(Tenant::query()->whereKey($tenant->id)->exists())->toBeTrue();
});

it('shows what goes with the store, and deletes nothing unless its name is typed', function () {
    $tenant = storeToDelete('متجر تجربة');
    Sanctum::actingAs(User::factory()->superAdmin()->create());

    $this->getJson("/api/v1/admin/tenants/{$tenant->id}/deletion")->assertOk()
        ->assertJsonPath('data.name', 'متجر تجربة')
        ->assertJsonPath('data.products', 1)
        ->assertJsonPath('data.orders', 1)
        ->assertJsonPath('data.landing_pages', 1)
        ->assertJsonPath('data.users', 1);

    $this->deleteJson("/api/v1/admin/tenants/{$tenant->id}", ['confirm' => 'متجر تاني'])->assertStatus(422)->assertJsonValidationErrors(['confirm']);
    $this->deleteJson("/api/v1/admin/tenants/{$tenant->id}", [])->assertStatus(422)->assertJsonValidationErrors(['confirm']);
    $this->deleteJson('/api/v1/admin/tenants/999999', ['confirm' => 'x'])->assertNotFound();
    expect(Tenant::query()->whereKey($tenant->id)->exists())->toBeTrue();
});

it('deletes the store with everything that belongs to it, and only that store', function () {
    $gone = storeToDelete('متجر تجربة');
    $kept = storeToDelete('متجر حقيقي');
    $users = User::query()->where('tenant_id', $gone->id)->pluck('id')->all();
    Sanctum::actingAs(User::factory()->superAdmin()->create());

    $this->deleteJson("/api/v1/admin/tenants/{$gone->id}", ['confirm' => '  متجر تجربة '])->assertNoContent();

    // The deleted store: no row anywhere, no files, no sign-ins.
    expect(Tenant::query()->whereKey($gone->id)->exists())->toBeFalse()
        ->and(User::query()->whereIn('id', $users)->exists())->toBeFalse()
        ->and(Domain::query()->withoutGlobalScopes()->where('tenant_id', $gone->id)->exists())->toBeFalse()
        ->and(PersonalAccessToken::query()->whereIn('tokenable_id', $users)->exists())->toBeFalse()
        ->and(UserNotification::query()->where('tenant_id', $gone->id)->exists())->toBeFalse()
        ->and(OutboundMessage::query()->whereNull('tenant_id')->exists())->toBeFalse();
    foreach ([LandingPage::class, Product::class, Order::class, Customer::class, Media::class, Identity::class, ThemePurchase::class] as $model) {
        expect($model::query()->withoutGlobalScopes()->where('tenant_id', $gone->id)->exists())->toBeFalse("{$model} left behind");
    }
    Storage::disk('public')->assertMissing("tenants/{$gone->id}/2026/11/a.webp");
    Storage::disk('local')->assertMissing("receipts/{$gone->id}/2026/11/r.webp");
    Storage::disk('local')->assertMissing("support/{$gone->id}/1/f.pdf");

    // The other store and the platform's own data are untouched.
    foreach ([LandingPage::class, Product::class, Order::class, Customer::class, Media::class, ThemePurchase::class] as $model) {
        expect($model::query()->withoutGlobalScopes()->where('tenant_id', $kept->id)->count())->toBe(1, "{$model} of the other store");
    }
    Storage::disk('public')->assertExists("tenants/{$kept->id}/2026/11/a.webp");
    expect(Theme::query()->whereKey('sufi_store')->exists())->toBeTrue();

    $log = AdminAuditLog::query()->where('action', 'tenant.delete')->firstOrFail();
    expect($log->target_id)->toBe((string) $gone->id)
        ->and($log->meta['name'])->toBe('متجر تجربة')
        ->and($log->meta['orders'])->toBe(1);
});
