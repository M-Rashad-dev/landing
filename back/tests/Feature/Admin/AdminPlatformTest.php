<?php

declare(strict_types=1);

use App\Billing\PlatformSettings;
use App\Enums\OrderStatus;
use App\Enums\TenantStatus;
use App\Mail\AdminAlertMail;
use App\Models\AdminAuditLog;
use App\Models\Customer;
use App\Models\Order;
use App\Models\PaymentMethod;
use App\Models\Product;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;

beforeEach(function () {
    $this->admin = User::factory()->superAdmin()->create();
    Sanctum::actingAs($this->admin);
});

function alertsOn(array $events = ['receipt_submitted', 'refund_requested', 'store_registered', 'daily_summary']): void
{
    app(PlatformSettings::class)->save(['alert_email' => 'owner@platform.test', 'alert_events' => $events]);
}

// --- home -------------------------------------------------------------------------------

it('shows the platform home: stores, sales of the month, last 30 days and top stores', function () {
    $owner = createOwner();
    asTenant($owner, function () {
        Order::factory()->count(2)->create(['total' => '500.00']);
        Order::factory()->status(OrderStatus::Cancelled)->create(['total' => '900.00']);
    });
    $other = createOwner();
    asTenant($other, fn () => Order::factory()->create(['total' => '100.00']));
    Tenant::factory()->create(['status' => TenantStatus::Suspended]);

    $data = $this->getJson('/api/v1/admin/overview')->assertOk()->json('data');

    expect($data['stores'])->toMatchArray(['total' => 3, 'active' => 2, 'suspended' => 1])
        // Cancelled orders are not sales.
        ->and($data['activity']['orders_today'])->toBe(3)
        ->and($data['activity']['sales_month'])->toEqual(1100)
        ->and($data['days'])->toHaveCount(30)
        ->and(collect($data['days'])->sum('orders'))->toBe(3)
        ->and($data['top_stores'][0])->toMatchArray(['id' => $owner->tenant_id, 'orders' => 2])
        ->and($data['top_stores'][0]['sales'])->toEqual(1000)
        ->and($data['billing'])->toHaveKeys(['revenue_month', 'revenue_previous', 'pending_payments', 'refund_requests']);
});

it('keeps the platform pages to the super admin', function () {
    app('auth')->forgetGuards();
    $this->getJson('/api/v1/admin/overview')->assertUnauthorized();
    $this->getJson('/api/v1/admin/alerts')->assertUnauthorized();
    $this->getJson('/api/v1/admin/audit-logs')->assertUnauthorized();

    Sanctum::actingAs(createOwner());
    $this->getJson('/api/v1/admin/overview')->assertForbidden();
    $this->getJson('/api/v1/admin/alerts')->assertForbidden();
    $this->putJson('/api/v1/admin/alerts', ['email' => 'x@y.com', 'events' => []])->assertForbidden();
    $this->getJson('/api/v1/admin/audit-logs')->assertForbidden();
});

// --- stores -----------------------------------------------------------------------------

it('lists stores with products, customers, sales, filters and sorting', function () {
    $big = createOwner(['name' => 'Big']);
    asTenant($big, function () {
        Order::factory()->count(3)->create(['total' => '200.00']);
        Order::factory()->status(OrderStatus::Fake)->create(['total' => '999.00']);
        Product::factory()->count(2)->create();
        Customer::query()->create(['name' => 'عميل', 'phone' => '+201000000001']);
    });
    $small = createOwner(['name' => 'Small']);
    asTenant($small, fn () => Order::factory()->create(['total' => '50.00']));
    $small->tenant->forceFill(['plan_ends_at' => now()->addDays(3)])->save();

    $rows = $this->getJson('/api/v1/admin/tenants?sort=sales')->assertOk()->json('data');
    expect($rows[0]['id'])->toBe($big->tenant_id)
        ->and($rows[0])->toMatchArray(['orders_count' => 3, 'products_count' => 2, 'customers_count' => 1])
        ->and($rows[0]['sales'])->toEqual(600)
        ->and($rows[0]['last_order_at'])->not->toBeNull()
        ->and($rows[0]['store_url'])->toStartWith('http');

    $this->getJson('/api/v1/admin/tenants?subscription=expiring')->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $small->tenant_id);
    $this->getJson('/api/v1/admin/tenants?sort=oldest')->assertJsonPath('data.0.id', $big->tenant_id);
    $this->getJson('/api/v1/admin/tenants?subscription=nope')->assertStatus(422);
    $this->getJson('/api/v1/admin/tenants?sort=nope')->assertStatus(422);
});

it('shows the history of one store, its payments included', function () {
    $owner = createOwner();
    $other = createOwner();
    $this->postJson("/api/v1/admin/tenants/{$owner->tenant_id}/suspend", ['reason' => 'مراجعة'])->assertOk();
    $this->postJson("/api/v1/admin/tenants/{$other->tenant_id}/suspend", ['reason' => 'مراجعة'])->assertOk();
    AdminAuditLog::query()->create(['admin_user_id' => $this->admin->id, 'action' => 'payment.approve', 'target_type' => 'payment', 'target_id' => '77', 'meta' => ['tenant_id' => $owner->tenant_id]]);

    $rows = $this->getJson("/api/v1/admin/audit-logs?tenant={$owner->tenant_id}")->assertOk()->json('data');
    expect(collect($rows)->pluck('action')->all())->toBe(['payment.approve', 'tenant.suspend'])
        ->and($rows[1]['admin']['name'])->toBe($this->admin->name)
        ->and($rows[1]['tenant']['id'])->toBe($owner->tenant_id);

    $this->getJson('/api/v1/admin/audit-logs?action=tenant.')->assertJsonCount(2, 'data');
    $this->getJson('/api/v1/admin/audit-logs?tenant=abc')->assertStatus(422);
});

// --- email alerts -----------------------------------------------------------------------

it('saves where the alerts go and which ones, and sends a test', function () {
    Mail::fake();
    $this->getJson('/api/v1/admin/alerts')->assertOk()
        ->assertJsonPath('data.email', null)
        ->assertJsonPath('data.mail_ready', false)
        ->assertJsonCount(5, 'data.available');
    $this->postJson('/api/v1/admin/alerts/test')->assertStatus(422)->assertJsonPath('code', 'alert_email_missing');

    $this->putJson('/api/v1/admin/alerts', ['email' => 'not-an-email', 'events' => []])->assertStatus(422)->assertJsonValidationErrors('email');
    $this->putJson('/api/v1/admin/alerts', ['email' => 'a@b.com', 'events' => ['nope']])->assertStatus(422)->assertJsonValidationErrors('events.0');
    $this->putJson('/api/v1/admin/alerts', ['email' => 'Owner@Platform.test', 'events' => ['receipt_submitted', 'daily_summary']])->assertOk()
        ->assertJsonPath('data.email', 'owner@platform.test')
        ->assertJsonPath('data.events', ['receipt_submitted', 'daily_summary']);
    expect(AdminAuditLog::query()->latest('id')->value('action'))->toBe('alerts.update');

    $this->postJson('/api/v1/admin/alerts/test')->assertOk()->assertJsonPath('data.sent_to', 'owner@platform.test');
    Mail::assertSent(AdminAlertMail::class, fn (AdminAlertMail $mail) => $mail->alert === 'test' && $mail->hasTo('owner@platform.test'));
});

it('emails the owner when a store sends a receipt', function () {
    Mail::fake();
    Storage::fake('local');
    alertsOn();
    PaymentMethod::query()->whereKey('instapay')->update(['is_active' => true, 'account_value' => 'platform@instapay']);
    $owner = User::factory()->for(Tenant::factory()->onPlan('basic')->create(['name' => 'متجر سما']))->create();
    Sanctum::actingAs($owner->fresh(['tenant']));

    $this->post('/api/v1/dashboard/billing/checkout', [
        'type' => 'subscription', 'plan_key' => 'pro', 'period' => 'monthly', 'method' => 'instapay',
        'sender_ref' => 'TX-1234', 'receipt' => UploadedFile::fake()->image('r.jpg', 600, 900),
    ], ['Accept' => 'application/json'])->assertCreated();

    Mail::assertQueued(AdminAlertMail::class, function (AdminAlertMail $mail) {
        $rows = collect($mail->rows)->pluck('value', 'label');

        return $mail->alert === 'receipt_submitted'
            && $mail->hasTo('owner@platform.test')
            && str_contains($mail->heading, 'متجر سما')
            && $rows[__('alerts.receipt.reference')] === 'TX-1234'
            && str_ends_with((string) $mail->actionUrl, '/admin/payments');
    });
});

it('emails the owner about a new store, and stays quiet when that alert is off', function () {
    Mail::fake();
    app('auth')->forgetGuards();
    alertsOn(['store_registered']);
    $payload = ['name' => 'منى', 'email' => 'mona@example.com', 'phone' => '01012345679', 'store_name' => 'Mona Store', 'password' => 'secret-pass-1', 'password_confirmation' => 'secret-pass-1'];

    $id = $this->postJson('/api/v1/auth/register', $payload)->assertCreated()->json('data.tenant.id');
    Mail::assertQueued(AdminAlertMail::class, fn (AdminAlertMail $mail) => $mail->alert === 'store_registered' && str_ends_with((string) $mail->actionUrl, '/admin/stores/'.$id));

    alertsOn(['receipt_submitted']);
    $this->postJson('/api/v1/auth/register', array_merge($payload, ['email' => 'other@example.com', 'phone' => '01012345670', 'store_name' => 'Other Store']))->assertCreated();
    Mail::assertQueuedCount(1);
});

it('sends the daily summary only when it is on', function () {
    Mail::fake();
    $this->artisan('admin:daily-summary')->assertSuccessful();
    Mail::assertNothingQueued();

    alertsOn(['daily_summary']);
    $owner = createOwner();
    asTenant($owner, fn () => Order::factory()->create(['total' => '250.00', 'created_at' => now()->subDay()]));

    $this->artisan('admin:daily-summary')->assertSuccessful();
    Mail::assertQueued(AdminAlertMail::class, function (AdminAlertMail $mail) {
        $rows = collect($mail->rows)->pluck('value', 'label');

        return $mail->alert === 'daily_summary' && $rows[__('alerts.daily.orders')] === '1';
    });
});

it('never breaks the action when the mail fails', function () {
    alertsOn(['store_registered']);
    Mail::shouldReceive('to')->andThrow(new RuntimeException('provider down'));
    app('auth')->forgetGuards();

    $this->postJson('/api/v1/auth/register', ['name' => 'منى', 'email' => 'mona2@example.com', 'phone' => '01012345671', 'store_name' => 'Mona Two', 'password' => 'secret-pass-1', 'password_confirmation' => 'secret-pass-1'])
        ->assertCreated();
});
