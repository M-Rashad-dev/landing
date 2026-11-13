<?php

declare(strict_types=1);

use App\Billing\BillingPriceCalculator;
use App\Billing\PlatformSettings;
use App\Billing\SubscriptionManager;
use App\Enums\AccessState;
use App\Enums\BillingPeriod;
use App\Mail\AdminAlertMail;
use App\Models\AdminAuditLog;
use App\Models\Invoice;
use App\Models\Payment;
use App\Models\PaymentMethod;
use App\Models\Subscription;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;

beforeEach(function () {
    Storage::fake('local');
    PaymentMethod::query()->whereKey('instapay')->update(['is_active' => true, 'account_value' => 'platform@instapay']);
});

function payOwner(string $plan = 'basic', bool $expired = false): User
{
    $tenant = $expired ? Tenant::factory()->expired($plan)->create() : Tenant::factory()->onPlan($plan)->create();
    $user = User::factory()->for($tenant)->create();
    Sanctum::actingAs($user->fresh(['tenant']));

    return $user;
}

/** The pay page of a plan period: what would be paid, nothing saved. */
function previewPlan(string $plan = 'pro', string $period = 'monthly')
{
    return test()->postJson('/api/v1/dashboard/billing/checkout/preview', ['type' => 'subscription', 'plan_key' => $plan, 'period' => $period]);
}

/** Sending the receipt for a plan period: the invoice is created with it. */
function buyPlan(string $plan = 'pro', string $period = 'monthly', array $overrides = [])
{
    return test()->post('/api/v1/dashboard/billing/checkout', array_merge([
        'type' => 'subscription',
        'plan_key' => $plan,
        'period' => $period,
        'method' => 'instapay',
        'sender_ref' => 'TX-998877',
        'receipt' => UploadedFile::fake()->image('receipt.jpg', 600, 900),
    ], $overrides), ['Accept' => 'application/json']);
}

function sendReceipt(int $invoiceId, array $overrides = [])
{
    return test()->post("/api/v1/dashboard/billing/invoices/{$invoiceId}/payments", array_merge([
        'method' => 'instapay',
        'sender_ref' => 'TX-998877',
        'receipt' => UploadedFile::fake()->image('receipt.jpg', 600, 900),
    ], $overrides), ['Accept' => 'application/json']);
}

function asAdmin(): User
{
    $admin = User::factory()->superAdmin()->create();
    Sanctum::actingAs($admin);

    return $admin;
}

// --- merchant ---------------------------------------------------------------------------

it('needs a signed-in owner', function () {
    previewPlan()->assertUnauthorized();
    buyPlan()->assertUnauthorized();
    $this->getJson('/api/v1/dashboard/billing/invoices')->assertUnauthorized();
});

it('shows the pay page with the price, the way to pay and the store reference, saving nothing', function () {
    $owner = payOwner('basic');

    previewPlan('pro', 'monthly')
        ->assertOk()
        ->assertJsonPath('data.id', null)
        ->assertJsonPath('data.number', null)
        ->assertJsonPath('data.total', 100)
        ->assertJsonPath('data.plan.name', 'برو')
        ->assertJsonPath('data.payable', true)
        ->assertJsonPath('data.pay_with.0.key', 'instapay')
        ->assertJsonPath('data.pay_with.0.account_value', 'platform@instapay')
        ->assertJsonPath('data.pay_with.0.amount', 100)
        ->assertJsonPath('data.pay_with.0.reference', sprintf('ST-%05d', $owner->tenant_id));

    // Only a look: no invoice until the receipt is sent.
    expect(Invoice::query()->withoutGlobalScopes()->count())->toBe(0);
    $this->getJson('/api/v1/dashboard/billing/invoices')->assertJsonCount(0, 'data');
});

it('creates the invoice together with the receipt', function () {
    payOwner('basic');

    buyPlan('pro')->assertCreated()
        ->assertJsonPath('data.status', 'pending_review')
        ->assertJsonPath('data.total', 100)
        ->assertJsonPath('data.payments.0.status', 'pending_review');

    expect(Invoice::query()->withoutGlobalScopes()->value('number'))->toStartWith('INV-');
});

it('hides methods the admin did not finish (off or without an account)', function () {
    PaymentMethod::query()->whereKey('vodafone_cash')->update(['is_active' => true, 'account_value' => null]);
    payOwner('basic');

    previewPlan()->assertOk()->assertJsonCount(1, 'data.pay_with');
});

it('validates the plan and period', function () {
    payOwner('basic');

    previewPlan('nope', 'monthly')->assertStatus(422)->assertJsonPath('code', 'plan_not_found');
    previewPlan('pro', 'weekly')->assertStatus(422)->assertJsonValidationErrors('period');
    $this->postJson('/api/v1/dashboard/billing/checkout/preview', ['type' => 'gift'])->assertStatus(422)->assertJsonValidationErrors('type');
});

it('charges only the difference when upgrading inside the first 7 days', function () {
    $owner = payOwner('basic');
    asTenant($owner, fn () => Subscription::query()->delete());
    app(SubscriptionManager::class)->subscribe($owner->tenant, app(BillingPriceCalculator::class)->planPrice('pro', BillingPeriod::Monthly), 10000, startsNow: true);
    Sanctum::actingAs($owner->fresh(['tenant']));

    previewPlan('max', 'monthly')->assertOk()->assertJsonPath('data.total', 50)->assertJsonPath('data.credit', 100)->assertJsonPath('data.starts_now', true);
    buyPlan('max')->assertCreated()->assertJsonPath('data.total', 50)->assertJsonPath('data.payments.0.amount', 50);
});

it('starts the plan at once when the credit covers everything (nothing to transfer)', function () {
    $owner = payOwner('basic');
    asTenant($owner, fn () => Subscription::query()->delete());
    app(SubscriptionManager::class)->subscribe($owner->tenant, app(BillingPriceCalculator::class)->planPrice('pro', BillingPeriod::Yearly), 120000, startsNow: true);
    Sanctum::actingAs($owner->fresh(['tenant']));

    previewPlan('max')->assertOk()->assertJsonPath('data.total', 0);
    expect(Invoice::query()->withoutGlobalScopes()->count())->toBe(0);
    $this->postJson('/api/v1/dashboard/billing/checkout', ['type' => 'subscription', 'plan_key' => 'max', 'period' => 'monthly'])
        ->assertCreated()->assertJsonPath('data.status', 'paid')->assertJsonPath('data.total', 0);
    expect($owner->tenant->fresh()->plan_key)->toBe('max');
});

it('refuses a new plan payment while a receipt is under review', function () {
    payOwner('basic');
    buyPlan('pro')->assertCreated();

    previewPlan('max')->assertStatus(422)->assertJsonPath('code', 'invoice_pending_review');
    buyPlan('max')->assertStatus(422)->assertJsonPath('code', 'invoice_pending_review');
    expect(Invoice::query()->withoutGlobalScopes()->count())->toBe(1);
});

it('stores the receipt privately and takes no second receipt on the same invoice', function () {
    payOwner('basic');
    $id = buyPlan()->assertCreated()
        ->assertJsonPath('data.payments.0.sender_ref', 'TX-998877')
        ->assertJsonMissingPath('data.payments.0.receipt_path')
        ->json('data.id');

    $path = Payment::query()->withoutGlobalScopes()->value('receipt_path');
    expect($path)->toStartWith('receipts/')->and(Storage::disk('local')->exists($path))->toBeTrue();
    sendReceipt($id)->assertStatus(422)->assertJsonPath('code', 'invoice_not_open');
});

it('validates receipts and methods, leaving no invoice behind', function () {
    payOwner('basic');

    buyPlan('pro', 'monthly', ['receipt' => UploadedFile::fake()->create('x.pdf', 10, 'application/pdf')])->assertStatus(422)->assertJsonValidationErrors('receipt');
    buyPlan('pro', 'monthly', ['receipt' => UploadedFile::fake()->create('fake.jpg', 10, 'image/jpeg')])->assertStatus(422)->assertJsonValidationErrors('receipt');
    buyPlan('pro', 'monthly', ['method' => 'vodafone_cash'])->assertStatus(422)->assertJsonValidationErrors('method');
    buyPlan('pro', 'monthly', ['sender_ref' => ''])->assertStatus(422)->assertJsonValidationErrors('sender_ref');
    buyPlan('pro', 'monthly', ['receipt' => null])->assertStatus(422)->assertJsonValidationErrors('receipt');

    expect(Invoice::query()->withoutGlobalScopes()->count())->toBe(0)->and(Payment::query()->withoutGlobalScopes()->count())->toBe(0);
});

it('refuses receipts for a rejected invoice left past its time', function () {
    $owner = payOwner('basic');
    $id = buyPlan()->json('data.id');
    asAdmin();
    $this->postJson('/api/v1/admin/payments/'.Payment::query()->withoutGlobalScopes()->value('id').'/reject', ['reason' => 'مش واضح'])->assertOk();
    Sanctum::actingAs($owner->fresh(['tenant']));
    $this->travel(49)->hours();

    sendReceipt($id)->assertStatus(422)->assertJsonPath('code', 'invoice_not_open');
    $this->artisan('invoices:expire')->assertSuccessful();
    expect(Invoice::query()->withoutGlobalScopes()->find($id)->status->value)->toBe('expired');
});

it('lets an expired store pay (the dashboard is read-only otherwise)', function () {
    payOwner('pro', expired: true);

    $this->postJson('/api/v1/dashboard/products', ['name' => 'x', 'price' => 1])->assertForbidden();
    previewPlan('pro')->assertOk();
    buyPlan('pro')->assertCreated();
});

it('isolates invoices and receipts between stores', function () {
    payOwner('basic');
    $mine = buyPlan()->assertCreated()->json('data.id');
    $payment = Payment::query()->withoutGlobalScopes()->value('id');

    $this->get("/api/v1/dashboard/billing/invoices/{$mine}/payments/{$payment}/receipt")->assertOk()->assertHeader('Content-Type', 'image/webp');

    payOwner('basic');
    $this->getJson("/api/v1/dashboard/billing/invoices/{$mine}")->assertNotFound();
    $this->get("/api/v1/dashboard/billing/invoices/{$mine}/payments/{$payment}/receipt", ['Accept' => 'application/json'])->assertNotFound();
    $this->postJson("/api/v1/dashboard/billing/invoices/{$mine}/cancel")->assertNotFound();
    $this->getJson('/api/v1/dashboard/billing/invoices')->assertOk()->assertJsonCount(0, 'data');
});

// --- admin review --------------------------------------------------------------------------

it('keeps the review queue to super admins', function () {
    $this->getJson('/api/v1/admin/payments')->assertUnauthorized();
    payOwner();
    $this->getJson('/api/v1/admin/payments')->assertForbidden();
    $this->postJson('/api/v1/admin/payments/1/approve')->assertForbidden();
});

it('approves a receipt once: invoice paid, plan started, audited', function () {
    $owner = payOwner('basic');
    $id = buyPlan('pro')->json('data.id');
    $payment = Payment::query()->withoutGlobalScopes()->value('id');

    asAdmin();
    $this->getJson('/api/v1/admin/payments')->assertOk()->assertJsonPath('meta.pending', 1)->assertJsonPath('data.0.invoice.total', 100);
    $this->get("/api/v1/admin/payments/{$payment}/receipt")->assertOk();
    $this->postJson("/api/v1/admin/payments/{$payment}/approve")->assertOk()->assertJsonPath('data.status', 'approved')->assertJsonPath('data.invoice.status', 'paid');
    $this->postJson("/api/v1/admin/payments/{$payment}/approve")->assertStatus(409);

    $tenant = $owner->tenant->fresh();
    $sub = asTenant($tenant, fn () => Subscription::query()->where('invoice_id', $id)->first());
    expect($tenant->plan_key)->toBe('pro')
        ->and($tenant->accessState())->toBe(AccessState::Active)
        ->and($sub->amount_paid)->toBe('100.00')
        ->and(asTenant($tenant, fn () => Subscription::query()->where('invoice_id', $id)->count()))->toBe(1)
        ->and(AdminAuditLog::query()->where('action', 'payment.approve')->exists())->toBeTrue();
});

it('rejects with a reason the merchant sees, then takes a new receipt', function () {
    $owner = payOwner('basic');
    $id = buyPlan('pro')->json('data.id');
    $payment = Payment::query()->withoutGlobalScopes()->value('id');

    asAdmin();
    $this->postJson("/api/v1/admin/payments/{$payment}/reject", ['reason' => ''])->assertStatus(422)->assertJsonValidationErrors('reason');
    $this->postJson("/api/v1/admin/payments/{$payment}/reject", ['reason' => 'المبلغ ناقص 20 جنيه'])->assertOk()->assertJsonPath('data.status', 'rejected');

    Sanctum::actingAs($owner->fresh(['tenant']));
    $this->getJson("/api/v1/dashboard/billing/invoices/{$id}")->assertJsonPath('data.status', 'open')->assertJsonPath('data.payments.0.reject_reason', 'المبلغ ناقص 20 جنيه');
    sendReceipt($id)->assertCreated()->assertJsonCount(2, 'data.payments');
    expect($owner->tenant->fresh()->plan_key)->toBe('basic');
});

it('finds receipts by store, store reference, transfer number, method and day, and flags a number sent twice', function () {
    $first = payOwner('basic');
    $first->tenant->forceFill(['name' => 'Sama Shop'])->save();
    buyPlan('pro')->assertCreated();
    $second = payOwner('basic');
    buyPlan('pro', 'monthly', ['sender_ref' => ' tx-998877 '])->assertCreated();
    $third = payOwner('basic');
    buyPlan('pro', 'monthly', ['sender_ref' => 'IP-1'])->assertCreated();

    asAdmin();
    $rows = $this->getJson('/api/v1/admin/payments')->assertOk()
        ->assertJsonPath('meta.counts.pending_review', 3)
        ->assertJsonPath('meta.counts.all', 3)
        ->json('data');
    expect(collect($rows)->pluck('repeated_ref', 'tenant.id')->all())
        ->toBe([$first->tenant_id => true, $second->tenant_id => true, $third->tenant_id => false]);

    $this->getJson('/api/v1/admin/payments?q=sama')->assertJsonCount(1, 'data')->assertJsonPath('data.0.tenant.id', $first->tenant_id);
    $this->getJson('/api/v1/admin/payments?q='.sprintf('ST-%05d', $third->tenant_id))->assertJsonCount(1, 'data')->assertJsonPath('data.0.tenant.id', $third->tenant_id);
    $this->getJson('/api/v1/admin/payments?q=IP-1')->assertJsonCount(1, 'data');
    $this->getJson('/api/v1/admin/payments?method=instapay')->assertJsonCount(3, 'data');
    $this->getJson('/api/v1/admin/payments?status=all&from='.now()->addDays(2)->toDateString())->assertJsonCount(0, 'data');
    $this->getJson('/api/v1/admin/payments?method=nope')->assertStatus(422);
    $this->getJson('/api/v1/admin/payments?from=2026-11-10&to=2026-11-01')->assertStatus(422);
});

it('edits payment methods (an active one needs its account) and audits it', function () {
    asAdmin();
    $body = ['name' => 'فودافون كاش', 'account_label' => 'رقم', 'account_value' => '', 'instructions' => null, 'is_active' => true, 'sort_order' => 2];

    $this->putJson('/api/v1/admin/payment-methods/vodafone_cash', $body)->assertStatus(422)->assertJsonValidationErrors('account_value');
    $this->putJson('/api/v1/admin/payment-methods/vodafone_cash', ['account_value' => '01012345678'] + $body)->assertOk()->assertJsonPath('data.is_active', true);
    $this->putJson('/api/v1/admin/payment-methods/nope', $body)->assertNotFound();
    expect(AdminAuditLog::query()->where('action', 'payment_method.update')->count())->toBe(1);
});

// --- refunds --------------------------------------------------------------------------------

function paidPro(User $owner): int
{
    Sanctum::actingAs($owner->fresh(['tenant']));
    $id = buyPlan('pro')->json('data.id');
    $payment = Payment::query()->withoutGlobalScopes()->where('invoice_id', $id)->value('id');
    asAdmin();
    test()->postJson("/api/v1/admin/payments/{$payment}/approve")->assertOk();
    Sanctum::actingAs($owner->fresh(['tenant']));

    return $id;
}

it('refunds a plan asked within 3 days: the period ends at once', function () {
    $owner = payOwner('basic');
    asTenant($owner, fn () => Subscription::query()->delete());
    $owner->tenant->forceFill(['plan_key' => null, 'plan_ends_at' => null, 'plan_grace_ends_at' => null])->save();
    $id = paidPro($owner);

    $this->getJson('/api/v1/dashboard/billing/invoices')->assertJsonPath('meta.refundable_invoice_id', $id);
    Mail::fake();
    app(PlatformSettings::class)->save(['alert_email' => 'owner@platform.test', 'alert_events' => ['refund_requested']]);
    $this->postJson('/api/v1/dashboard/billing/refund', ['reason' => 'مش محتاجها'])->assertOk()->assertJsonPath('data.refund_reason', 'مش محتاجها');
    Mail::assertQueued(AdminAlertMail::class, fn (AdminAlertMail $mail) => $mail->alert === 'refund_requested' && in_array('مش محتاجها', array_column($mail->rows, 'value'), true));
    $this->postJson('/api/v1/dashboard/billing/refund', ['reason' => 'تاني'])->assertStatus(422)->assertJsonPath('code', 'refund_not_allowed');

    asAdmin();
    $this->getJson('/api/v1/admin/refunds')->assertOk()->assertJsonPath('data.0.number', sprintf('INV-%06d', $id));
    $this->postJson("/api/v1/admin/invoices/{$id}/refund", ['refund_ref' => 'IP-55443322'])->assertOk()->assertJsonPath('data.0.status', 'refunded');
    $this->postJson("/api/v1/admin/invoices/{$id}/refund", ['refund_ref' => 'IP-55443322'])->assertStatus(409);

    expect($owner->tenant->fresh()->accessState())->toBe(AccessState::Expired);
});

it('allows no refund after 3 days', function () {
    $owner = payOwner('basic');
    paidPro($owner);
    $this->travel(4)->days();

    $this->postJson('/api/v1/dashboard/billing/refund', ['reason' => 'متأخر'])->assertStatus(422)->assertJsonPath('code', 'refund_not_allowed');
});

it('counts money waiting for the admin on the overview', function () {
    payOwner('basic');
    buyPlan()->assertCreated();
    asAdmin();

    $this->getJson('/api/v1/admin/overview')->assertOk()->assertJsonPath('data.billing.pending_payments', 1)->assertJsonPath('data.billing.refund_requests', 0);
});

it('lists only invoices that have a receipt (or were paid / refunded)', function () {
    $owner = payOwner('basic');
    $id = buyPlan('pro')->assertCreated()->json('data.id');
    // A leftover invoice from the old flow: opened, never paid, cancelled.
    $leftover = Invoice::query()->withoutGlobalScopes()->whereKey($id)->firstOrFail()->replicate(['number']);
    $leftover->forceFill(['number' => 'INV-LEFT', 'status' => 'cancelled'])->save();

    $this->getJson('/api/v1/dashboard/billing/invoices')->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $id)->assertJsonPath('data.0.status', 'pending_review');
    expect($owner->tenant_id)->toBe($leftover->tenant_id);
});
