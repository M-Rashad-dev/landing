<?php

declare(strict_types=1);

use App\Billing\PlatformSettings;
use App\Enums\OrderStatus;
use App\Enums\TenantStatus;
use App\Mail\NotificationMail;
use App\Models\AdminAuditLog;
use App\Models\Customer;
use App\Models\Order;
use App\Models\PaymentMethod;
use App\Models\Product;
use App\Models\Tenant;
use App\Models\User;
use App\Models\UserNotification;
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
    app(PlatformSettings::class)->save(['alert_channel' => 'email', 'alert_email' => 'owner@platform.test', 'alert_events' => $events]);
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
    $this->putJson('/api/v1/admin/alerts', ['channel' => 'email', 'phone' => null, 'email' => 'x@y.com', 'events' => []])->assertForbidden();
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
        ->assertJsonPath('data.channel', 'whatsapp')
        ->assertJsonPath('data.email', null)
        ->assertJsonPath('data.own_email', $this->admin->email)
        ->assertJsonPath('data.mail_ready', false)
        ->assertJsonPath('data.whatsapp_ready', false)
        ->assertJsonCount(5, 'data.available');

    $valid = ['channel' => 'email', 'phone' => null, 'email' => 'a@b.com', 'events' => []];
    $this->putJson('/api/v1/admin/alerts', ['email' => 'not-an-email'] + $valid)->assertStatus(422)->assertJsonValidationErrors('email');
    $this->putJson('/api/v1/admin/alerts', ['events' => ['nope']] + $valid)->assertStatus(422)->assertJsonValidationErrors('events.0');
    $this->putJson('/api/v1/admin/alerts', ['channel' => 'sms'] + $valid)->assertStatus(422)->assertJsonValidationErrors('channel');
    $this->putJson('/api/v1/admin/alerts', ['phone' => '123'] + $valid)->assertStatus(422)->assertJsonValidationErrors('phone');
    $this->putJson('/api/v1/admin/alerts', ['channel' => 'whatsapp', 'phone' => '01099998888', 'email' => 'Owner@Platform.test', 'events' => ['receipt_submitted', 'daily_summary']])->assertOk()
        ->assertJsonPath('data.channel', 'whatsapp')
        ->assertJsonPath('data.phone', '+201099998888')
        ->assertJsonPath('data.email', 'owner@platform.test')
        ->assertJsonPath('data.events', ['receipt_submitted', 'daily_summary']);
    expect(AdminAuditLog::query()->latest('id')->value('action'))->toBe('alerts.update');

    $this->postJson('/api/v1/admin/alerts/test')->assertOk()->assertJsonPath('data.sent_to', 'owner@platform.test');
    Mail::assertSent(NotificationMail::class, fn (NotificationMail $mail) => $mail->event === 'test' && $mail->hasTo('owner@platform.test'));
});

it('tells the owner when a store sends a receipt: the bell and the email', function () {
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

    Mail::assertSent(NotificationMail::class, function (NotificationMail $mail) {
        $rows = collect($mail->rows)->pluck('value', 'label');

        return $mail->event === 'receipt_submitted'
            && $mail->hasTo('owner@platform.test')
            && str_contains($mail->heading, 'متجر سما')
            && $rows[__('alerts.receipt.reference')] === 'TX-1234'
            && str_ends_with((string) $mail->actionUrl, '/admin/payments');
    });
    $bell = UserNotification::query()->where('user_id', $this->admin->id)->sole();
    expect($bell->event->value)->toBe('receipt_submitted')->and($bell->link)->toBe('/admin/payments');
});

it('tells the owner about a new store, and only rings the bell when that alert is off', function () {
    Mail::fake();
    app('auth')->forgetGuards();
    alertsOn(['store_registered']);
    $payload = ['name' => 'منى', 'email' => 'mona@example.com', 'phone' => '01012345679', 'store_name' => 'Mona Store', 'password' => 'secret-pass-1', 'password_confirmation' => 'secret-pass-1'];

    $id = $this->postJson('/api/v1/auth/register', $payload)->assertCreated()->json('data.tenant.id');
    Mail::assertSent(NotificationMail::class, fn (NotificationMail $mail) => $mail->event === 'store_registered' && str_ends_with((string) $mail->actionUrl, '/admin/stores/'.$id));

    alertsOn(['receipt_submitted']);
    $this->postJson('/api/v1/auth/register', array_merge($payload, ['email' => 'other@example.com', 'phone' => '01012345670', 'store_name' => 'Other Store']))->assertCreated();
    Mail::assertSentCount(1);
    expect(UserNotification::query()->where('user_id', $this->admin->id)->count())->toBe(2);
});

it('sends the daily summary only when it is on, once a day', function () {
    Mail::fake();
    alertsOn([]);
    $this->artisan('admin:daily-summary')->assertSuccessful();
    Mail::assertNothingSent();

    alertsOn(['daily_summary']);
    $owner = createOwner();
    asTenant($owner, fn () => Order::factory()->create(['total' => '250.00', 'created_at' => now()->subDay()]));

    $this->artisan('admin:daily-summary')->assertSuccessful();
    $this->artisan('admin:daily-summary')->assertSuccessful();
    Mail::assertSent(NotificationMail::class, function (NotificationMail $mail) {
        $rows = collect($mail->rows)->pluck('value', 'label');

        return $mail->event === 'daily_summary' && $rows[__('alerts.daily.orders')] === '1';
    });
    Mail::assertSentCount(1);
});

it('never breaks the action when the mail fails', function () {
    alertsOn(['store_registered']);
    Mail::shouldReceive('to')->andThrow(new RuntimeException('provider down'));
    app('auth')->forgetGuards();

    $this->postJson('/api/v1/auth/register', ['name' => 'منى', 'email' => 'mona2@example.com', 'phone' => '01012345671', 'store_name' => 'Mona Two', 'password' => 'secret-pass-1', 'password_confirmation' => 'secret-pass-1'])
        ->assertCreated();
});
