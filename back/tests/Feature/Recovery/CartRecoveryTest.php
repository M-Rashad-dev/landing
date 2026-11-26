<?php

declare(strict_types=1);

use App\Actions\Orders\CaptureLead;
use App\Ai\Copilot\CopilotContext;
use App\Ai\Copilot\CopilotTools;
use App\Billing\PlanCatalog;
use App\Billing\PlatformSettings;
use App\Enums\LeadStatus;
use App\Enums\MessagePurpose;
use App\Jobs\SendManualReminders;
use App\Mail\CustomerOrderMail;
use App\Messaging\WhatsApp\WhatsAppTemplates;
use App\Models\AbandonedLead;
use App\Models\BlockedCustomer;
use App\Models\DiscountCode;
use App\Models\Domain;
use App\Models\LeadReminder;
use App\Models\MessageWalletEntry;
use App\Models\Order;
use App\Models\OutboundMessage;
use App\Models\PaymentMethod;
use App\Models\PlanFeatureValue;
use App\Models\Product;
use App\Models\Tenant;
use App\Models\User;
use App\Models\UserNotification;
use App\Recovery\CartRecovery;
use App\Recovery\MessageWallets;
use App\Tenancy\Tenancy;
use Carbon\CarbonImmutable;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Mail;
use Laravel\Sanctum\Sanctum;

const CR_GRAPH = 'https://graph.facebook.com/v23.0';
const CR_PHONE = '+201011113333';
const CR_HOST = 'habba-recovery.localhost';

beforeEach(function () {
    Mail::fake();
    config([
        'services.whatsapp.token' => 't', 'services.whatsapp.phone_number_id' => '111', 'services.whatsapp.waba_id' => '222',
        'services.whatsapp.app_secret' => 'test-secret', 'services.whatsapp.graph_url' => CR_GRAPH,
    ]);
    Cache::put('whatsapp:template-status', ['cart_reminder_v1' => ['status' => 'APPROVED', 'category' => 'MARKETING'], 'cart_reminder_coupon_v1' => ['status' => 'APPROVED', 'category' => 'MARKETING']], now()->addYear());
    $n = 0;
    Http::fake([CR_GRAPH.'/111/messages' => function () use (&$n) {
        $n++;

        return Http::response(['messages' => [['id' => 'wamid.R'.$n]]]);
    }]);
    // Noon in Cairo: outside the quiet hours.
    $this->travelTo(CarbonImmutable::parse('2026-11-24 12:00', 'Africa/Cairo'));
    $tenant = Tenant::factory()->onPlan('pro')->create(['name' => 'متجر حبة']);
    $this->owner = User::factory()->for($tenant)->create();
    Domain::factory()->for($tenant)->create(['host' => CR_HOST, 'active_host' => CR_HOST]);
    Sanctum::actingAs($this->owner->fresh(['tenant']));
});

function crOn(array $settings = []): void
{
    test()->putJson('/api/v1/dashboard/leads/recovery', $settings + ['enabled' => true, 'whatsapp' => true, 'email' => true, 'first_minutes' => 60, 'second_hours' => 24, 'coupon_mode' => 'none', 'coupon_type' => 'percentage'])->assertOk();
}

function crLead(array $attributes = []): AbandonedLead
{
    return asTenant(test()->owner, function () use ($attributes) {
        $product = Product::factory()->create(['name' => 'تيشيرت قطن', 'price' => '200.00']);

        return AbandonedLead::query()->forceCreate($attributes + [
            'source' => 'store', 'customer_phone' => CR_PHONE, 'customer_name' => 'سارة محمد', 'status' => LeadStatus::Open, 'quantity' => 2,
            'product_id' => $product->id, 'cart' => ['items' => [['product_id' => $product->id, 'name' => 'تيشيرت قطن', 'quantity' => 2, 'options' => ['7' => 21]]], 'total' => 400],
            'last_seen_at' => now()->subHours(2), 'created_at' => now()->subHours(2),
        ]);
    });
}

function crBalance(int $messages): void
{
    app(MessageWallets::class)->credit(test()->owner->tenant_id, $messages, 'adjust', 'test');
}

function crRun(): int
{
    return app(CartRecovery::class)->run();
}

/** @return list<array<string, mixed>> the WhatsApp templates sent */
function crTemplates(): array
{
    return collect(Http::recorded())->map(fn ($pair) => $pair[0]->data())->filter(fn (array $d) => ($d['type'] ?? null) === 'template')->values()->all();
}

function crWebhook(array $value)
{
    $raw = json_encode(['object' => 'whatsapp_business_account', 'entry' => [['changes' => [['field' => 'messages', 'value' => $value]]]]]);

    return test()->call('POST', '/api/v1/webhooks/whatsapp', [], [], [], test()->transformHeadersToServerVars(internalHeaders() + ['Content-Type' => 'application/json', 'X-Hub-Signature-256' => 'sha256='.hash_hmac('sha256', $raw, 'test-secret')]), $raw);
}

it('keeps the settings, checked, per store and behind the plan', function () {
    $this->getJson('/api/v1/dashboard/leads/recovery')->assertOk()->assertJsonPath('data.enabled', false)->assertJsonPath('data.balance', 0)
        ->assertJsonPath('data.whatsapp_available', true)->assertJsonPath('data.packs.0.messages', 100);
    $this->putJson('/api/v1/dashboard/leads/recovery', ['enabled' => true, 'whatsapp' => true, 'email' => true, 'first_minutes' => 5, 'second_hours' => 100, 'coupon_mode' => 'x', 'coupon_type' => 'percentage'])
        ->assertStatus(422)->assertJsonValidationErrors(['first_minutes', 'second_hours', 'coupon_mode']);
    $this->putJson('/api/v1/dashboard/leads/recovery', ['enabled' => true, 'whatsapp' => true, 'email' => true, 'first_minutes' => 60, 'second_hours' => 24, 'coupon_mode' => 'code', 'coupon_type' => 'percentage'])
        ->assertStatus(422)->assertJsonValidationErrors(['discount_code_id']);
    $foreign = asTenant(Tenant::factory()->onPlan('pro')->create(), fn () => DiscountCode::factory()->create()->id);
    $this->putJson('/api/v1/dashboard/leads/recovery', ['enabled' => true, 'whatsapp' => true, 'email' => true, 'first_minutes' => 60, 'second_hours' => 24, 'coupon_mode' => 'code', 'discount_code_id' => $foreign, 'coupon_type' => 'percentage'])
        ->assertStatus(422)->assertJsonValidationErrors(['discount_code_id']);
    crOn(['coupon_mode' => 'generated', 'coupon_value' => 10]);
    $this->getJson('/api/v1/dashboard/leads/recovery')->assertJsonPath('data.enabled', true)->assertJsonPath('data.coupon_value', 10);

    // Another store starts off; a plan without abandoned orders can't open it; signed out → 401.
    $other = User::factory()->for(Tenant::factory()->onPlan('pro')->create())->create();
    Sanctum::actingAs($other->fresh(['tenant']));
    $this->getJson('/api/v1/dashboard/leads/recovery')->assertJsonPath('data.enabled', false);
    Sanctum::actingAs(User::factory()->for(Tenant::factory()->onPlan('basic')->create())->create()->fresh(['tenant']));
    $this->getJson('/api/v1/dashboard/leads/recovery')->assertForbidden();
    app('auth')->forgetGuards();
    $this->withHeaders(['Authorization' => ''])->getJson('/api/v1/dashboard/leads/recovery')->assertUnauthorized();
});

it('sells message packs through a billing invoice that fills the balance once paid', function () {
    PaymentMethod::query()->whereKey('instapay')->update(['is_active' => true, 'account_value' => 'platform@instapay']);
    $this->postJson('/api/v1/dashboard/billing/checkout/preview', ['type' => 'message_pack', 'messages' => 77])->assertStatus(422)->assertJsonValidationErrors('messages');
    $this->postJson('/api/v1/dashboard/billing/checkout/preview', ['type' => 'message_pack', 'messages' => 500])->assertOk()
        ->assertJsonPath('data.total', 450)->assertJsonPath('data.message_pack.messages', 500);
    $invoice = $this->post('/api/v1/dashboard/billing/checkout', [
        'type' => 'message_pack', 'messages' => 500, 'method' => 'instapay', 'sender_ref' => 'TX-112233', 'receipt' => UploadedFile::fake()->image('r.jpg', 600, 900),
    ], ['Accept' => 'application/json'])->assertCreated()->json('data');
    $this->getJson('/api/v1/dashboard/leads/recovery')->assertJsonPath('data.pending.messages', 500)->assertJsonPath('data.balance', 0);

    Sanctum::actingAs(User::factory()->superAdmin()->create());
    $this->postJson('/api/v1/admin/payments/'.$invoice['payments'][0]['id'].'/approve')->assertOk();

    Sanctum::actingAs($this->owner->fresh(['tenant']));
    $this->getJson('/api/v1/dashboard/leads/recovery')->assertJsonPath('data.balance', 500)->assertJsonPath('data.pending', null);
    $this->getJson('/api/v1/dashboard/leads/recovery/entries')->assertOk()->assertJsonPath('data.0.type', 'topup')->assertJsonPath('data.0.messages', 500);

    // The admin sets the packs.
    app(PlatformSettings::class)->save(['message_packs' => [['messages' => 50, 'price' => 60]]]);
    PlatformSettings::flush();
    expect(app(MessageWallets::class)->packs())->toBe([['messages' => 50, 'price' => 60]]);
});

it('sends two reminders on time, the second with a one-time code, one message each', function () {
    crOn(['coupon_mode' => 'generated', 'coupon_value' => 10]);
    crBalance(5);
    $lead = crLead();

    expect(crRun())->toBe(1);
    $first = crTemplates()[0];
    $token = app(CartRecovery::class)->token($lead);
    expect($first['template']['name'])->toBe('cart_reminder_v1')
        ->and($first['template']['components'][0]['parameters'][0]['text'])->toBe('سارة')
        ->and($first['template']['components'][0]['parameters'][2]['text'])->toBe('تيشيرت قطن × 2')
        ->and($first['template']['components'][1]['parameters'][0]['text'])->toBe($token)
        ->and($first['template']['components'][2]['index'])->toBe('1')
        ->and(app(MessageWallets::class)->balance($this->owner->tenant_id))->toBe(4);
    expect(crRun())->toBe(0);

    $this->travel(24)->hours();
    expect(crRun())->toBe(1);
    $second = crTemplates()[1];
    $code = asTenant($this->owner, fn () => DiscountCode::query()->where('recovery', true)->firstOrFail());
    expect($second['template']['name'])->toBe('cart_reminder_coupon_v1')
        ->and($second['template']['components'][0]['parameters'][3]['text'])->toBe($code->code)
        ->and($second['template']['components'][0]['parameters'][4]['text'])->toBe('10%')
        ->and($code->usage_limit)->toBe(1);
    // Kept out of the coupons list.
    $this->getJson('/api/v1/dashboard/discount-codes')->assertOk()->assertJsonCount(0, 'data');

    $this->travel(48)->hours();
    expect(crRun())->toBe(0)
        ->and(asTenant($this->owner, fn () => $lead->fresh()->reminders_sent))->toBe(2)
        ->and(app(MessageWallets::class)->balance($this->owner->tenant_id))->toBe(3);
});

it('waits for the morning and stops for every stop rule', function () {
    crOn();
    crBalance(20);

    $this->travelTo(CarbonImmutable::parse('2026-11-24 23:30', 'Africa/Cairo'));
    crLead();
    $this->travel(3)->hours();
    expect(crRun())->toBe(0);
    $this->travelTo(CarbonImmutable::parse('2026-11-25 09:05', 'Africa/Cairo'));
    expect(crRun())->toBe(1);

    $recovery = app(CartRecovery::class);
    $reasons = asTenant($this->owner, function () use ($recovery) {
        AbandonedLead::query()->delete();
        $out = [];
        $out[] = $recovery->stopReason(crLead(['status' => LeadStatus::Contacted]));
        $out[] = $recovery->stopReason(crLead(['created_at' => now()->subDays(4)]));
        $lead = crLead(['customer_phone' => '+201099990000']);
        Order::factory()->create(['customer_phone' => '+201099990000']);
        $out[] = $recovery->stopReason($lead);
        $lead = crLead(['customer_phone' => '+201088880000']);
        BlockedCustomer::query()->create(['type' => 'phone', 'value' => '+201088880000', 'reason' => 'x']);
        $out[] = $recovery->stopReason($lead);
        $out[] = $recovery->stopReason(crLead(['customer_phone' => '+201077770000', 'opted_out_at' => now()]));
        $out[] = $recovery->stopReason(crLead(['customer_phone' => '+201066660000']));

        return $out;
    });
    expect($reasons)->toBe(['handled', 'old', 'ordered', 'blocked', 'opted_out', null]);
});

it('emails when the balance runs out, tells the merchant once, and gives back a message WhatsApp failed', function () {
    crOn(['second_hours' => null]);
    crLead(['customer_email' => 'sara@example.com']);
    crLead(['customer_phone' => '+201055554444']);

    expect(crRun())->toBe(1);
    expect(crTemplates())->toBe([]);
    Mail::assertSent(CustomerOrderMail::class, fn (CustomerOrderMail $m) => $m->event === 'cart_reminder' && str_contains((string) $m->actionUrl, CR_HOST) && str_contains((string) $m->actionUrl, '/checkout?r=') && str_contains($m->footer, '/u/'));
    expect(asTenant($this->owner, fn () => UserNotification::query()->where('event', 'recovery_balance_empty')->count()))->toBe(1);
    crRun();
    expect(asTenant($this->owner, fn () => UserNotification::query()->where('event', 'recovery_balance_empty')->count()))->toBe(1);

    crBalance(3);
    expect(crRun())->toBe(1);
    $message = asTenant($this->owner, fn () => OutboundMessage::query()->where('purpose', MessagePurpose::CartReminder)->where('channel', 'whatsapp')->firstOrFail());
    expect(app(MessageWallets::class)->balance($this->owner->tenant_id))->toBe(2);
    crWebhook(['statuses' => [['id' => $message->provider_id, 'status' => 'failed', 'timestamp' => (string) now()->timestamp, 'errors' => [['code' => 131049, 'title' => 'x']]]]])->assertOk();
    expect(app(MessageWallets::class)->balance($this->owner->tenant_id))->toBe(3)
        ->and(asTenant($this->owner, fn () => MessageWalletEntry::query()->latest('id')->value('type')))->toBe('refund')
        ->and(asTenant($this->owner, fn () => LeadReminder::query()->where('charged', true)->count()))->toBe(0);
});

it('stops on «مش مهتم» for that cart only, from that phone, and from the email link', function () {
    crOn();
    crBalance(5);
    $lead = crLead(['customer_email' => 'sara@example.com']);
    $payload = app(CartRecovery::class)->payload($lead);

    $press = fn (string $p, string $from) => crWebhook(['messages' => [['from' => $from, 'id' => 'wamid.in'.random_int(1, 99999), 'type' => 'button', 'button' => ['payload' => $p, 'text' => 'مش مهتم']]]]);
    $press(substr($payload, 0, -3).'abc', '201011113333')->assertOk();
    $press($payload, '201099998888')->assertOk();
    expect($lead->fresh()->opted_out_at)->toBeNull();
    $press($payload, '201011113333')->assertOk();
    expect($lead->fresh()->opted_out_at)->not->toBeNull()->and(crRun())->toBe(0);
    // The dashboard shows it.
    $this->getJson('/api/v1/dashboard/leads?source=store')->assertJsonPath('data.0.opted_out_at', fn ($v) => $v !== null);

    // Another cart of the same phone still gets its reminders.
    $next = crLead(['source' => 'cart', 'cart_token' => 'cart_'.str_repeat('n', 20)]);
    expect(crRun())->toBe(1)->and($next->fresh()->reminders_sent)->toBe(1);

    $other = crLead(['customer_phone' => '+201022223333', 'customer_email' => 'mona@example.com']);
    $this->postJson('/api/v1/public/recovery/unsubscribe', ['token' => app(CartRecovery::class)->token($other)], internalHeaders())->assertOk()->assertJsonPath('data.store', 'متجر حبة');
    expect($other->fresh()->opted_out_at)->not->toBeNull();
});

it('asks again once the customer changes the cart they said «مش مهتم» about, and leaves it out of a manual send until then', function () {
    $product = asTenant($this->owner, fn () => Product::factory()->create(['price' => '100.00', 'in_store' => true]));
    $lead = asTenant($this->owner, function () use ($product) {
        app(CaptureLead::class)->abandonedCart('cart_'.str_repeat('c', 20), ['phone' => CR_PHONE], ['items' => [['product_id' => $product->id, 'name' => 'x', 'quantity' => 1, 'options' => []]], 'total' => 100]);

        return AbandonedLead::query()->where('source', 'cart')->firstOrFail();
    });
    app(CartRecovery::class)->optOut($lead, false);
    crBalance(5);
    $this->postJson('/api/v1/dashboard/leads/recovery/remind', ['ids' => [$lead->id]])->assertStatus(422)->assertJsonPath('code', 'nothing_to_remind');

    // The same cart again: still stopped. A changed one: reminders may go.
    asTenant($this->owner, fn () => app(CaptureLead::class)->abandonedCart('cart_'.str_repeat('c', 20), ['phone' => CR_PHONE], ['items' => [['product_id' => $product->id, 'name' => 'x', 'quantity' => 1, 'options' => []]], 'total' => 100]));
    expect($lead->fresh()->opted_out_at)->not->toBeNull();
    asTenant($this->owner, fn () => app(CaptureLead::class)->abandonedCart('cart_'.str_repeat('c', 20), ['phone' => CR_PHONE], ['items' => [['product_id' => $product->id, 'name' => 'x', 'quantity' => 2, 'options' => []]], 'total' => 200]));
    expect($lead->fresh()->opted_out_at)->toBeNull();
    $this->postJson('/api/v1/dashboard/leads/recovery/remind', ['ids' => [$lead->id]])->assertStatus(202);
    expect($lead->fresh()->reminders_sent)->toBe(1);
});

it('restores the cart from the link on the store host only', function () {
    $lead = crLead();
    $token = app(CartRecovery::class)->token($lead);

    $url = $this->getJson('/api/v1/public/recovery-link?token='.$token, internalHeaders())->assertOk()->json('data.url');
    expect($url)->toContain(CR_HOST)->toEndWith('/checkout?r='.$token);
    $this->getJson('/api/v1/public/recovery?token='.$token.'&host='.CR_HOST, internalHeaders())->assertOk()
        ->assertJsonPath('data.kind', 'store')->assertJsonPath('data.items.0.quantity', 2)->assertJsonPath('data.items.0.options.7', 21)->assertJsonPath('data.items.0.name', 'تيشيرت قطن')->assertJsonPath('data.items.0.price', 200)
        ->assertJsonPath('data.customer.name', 'سارة محمد');
    $otherHost = 'other-shop.localhost';
    Domain::factory()->for(Tenant::factory()->create())->create(['host' => $otherHost, 'active_host' => $otherHost]);
    $this->getJson('/api/v1/public/recovery?token='.$token.'&host='.$otherHost, internalHeaders())->assertNotFound();
    $this->getJson('/api/v1/public/recovery-link?token='.str_repeat('a', 24), internalHeaders())->assertNotFound();
    $this->getJson('/api/v1/public/recovery-link?token=bad', internalHeaders())->assertStatus(422);
});

it('counts an order after a reminder as brought back', function () {
    crOn();
    crBalance(5);
    $lead = crLead();
    crRun();

    asTenant($this->owner, function () use ($lead) {
        $order = Order::factory()->create(['customer_phone' => CR_PHONE, 'total' => '400.00']);
        app(CaptureLead::class)->converted($order);
        expect($lead->fresh()->recovered_at)->not->toBeNull()->and($lead->fresh()->status)->toBe(LeadStatus::Converted);
    });
    $this->getJson('/api/v1/dashboard/leads/recovery')->assertJsonPath('data.stats.recovered', 1)->assertJsonPath('data.stats.revenue', 400)->assertJsonPath('data.stats.whatsapp', 1);
    $this->getJson('/api/v1/dashboard/leads?status=converted')->assertOk()->assertJsonPath('data.0.reminders_sent', 1)->assertJsonPath('data.0.recovered_at', fn ($v) => $v !== null);
});

it('gives the copilot the reminders report and the abandoned orders', function () {
    app(PlatformSettings::class)->save(['ai_features' => ['support' => false, 'designer' => false, 'copilot' => true], 'ai_usd_rate' => 50, 'ai_margin_percent' => 10, 'ai_welcome_credit' => 0]);
    PlanFeatureValue::query()->updateOrCreate(['plan_key' => 'pro', 'entitlement' => 'ai'], ['value' => 1]);
    PlanCatalog::flush();
    crOn();
    crLead();
    $ctx = new CopilotContext($this->owner->tenant->fresh(), $this->owner, null);
    $run = fn (string $name, array $args) => Tenancy::runAs($this->owner->tenant_id, fn () => app(CopilotTools::class)->run($name, $args, $ctx));

    $report = $run('run_report', ['report' => 'cart_recovery', 'params' => []]);
    expect($report->failed)->toBeFalse()->and(json_encode($report->data))->toContain('message_balance');
    $leads = $run('find_records', ['resource' => 'abandoned_leads']);
    expect($leads->failed)->toBeFalse()->and(json_encode($leads->data, JSON_UNESCAPED_UNICODE))->not->toContain('سارة');
});

it('sends a manual reminder to everyone or to the picked carts, counted as the next step', function () {
    crOn();
    crBalance(10);
    $fresh = crLead(['customer_phone' => '+201011110001']);
    $once = crLead(['customer_phone' => '+201011110002', 'reminders_sent' => 1, 'last_reminded_at' => now()->subHour()]);
    $twice = crLead(['customer_phone' => '+201011110003', 'reminders_sent' => 2, 'last_reminded_at' => now()->subHour()]);
    // Out of reach: no phone, older than 14 days, waiting on an order's payment.
    crLead(['customer_phone' => null]);
    crLead(['customer_phone' => '+201011110005', 'created_at' => now()->subDays(15)]);
    crLead(['customer_phone' => '+201011110006', 'order_id' => asTenant($this->owner, fn () => Order::factory()->create()->id)]);

    // The picked ones only, then everyone (night hours don't matter for a manual one).
    $this->travelTo(CarbonImmutable::parse('2026-11-24 23:30', 'Africa/Cairo'));
    $this->postJson('/api/v1/dashboard/leads/recovery/remind', ['ids' => [$fresh->id]])->assertStatus(202)->assertJsonPath('data.count', 1);
    expect($fresh->fresh()->reminders_sent)->toBe(1)->and(crTemplates())->toHaveCount(1)
        ->and(crTemplates()[0]['template']['name'])->toBe(WhatsAppTemplates::name('cart_reminder'));
    // Another tab's kind is left alone.
    $this->postJson('/api/v1/dashboard/leads/recovery/remind', ['source' => 'cart'])->assertStatus(422)->assertJsonPath('code', 'nothing_to_remind');
    $this->postJson('/api/v1/dashboard/leads/recovery/remind', ['source' => 'store'])->assertStatus(202)->assertJsonPath('data.count', 3);
    expect([$fresh->fresh()->reminders_sent, $once->fresh()->reminders_sent, $twice->fresh()->reminders_sent])->toBe([2, 2, 3])
        // No coupon in a manual one, even as the second step.
        ->and(collect(crTemplates())->pluck('template.name')->unique()->values()->all())->toBe([WhatsAppTemplates::name('cart_reminder')]);

    // The automatic second never follows a reminder already counted as the second.
    $this->travelTo(CarbonImmutable::parse('2026-11-26 12:00', 'Africa/Cairo'));
    expect(crRun())->toBe(0);
});

it('makes the automatic reminder that follows a manual first one the second', function () {
    crOn();
    crBalance(10);
    $lead = crLead();

    $this->postJson('/api/v1/dashboard/leads/recovery/remind', ['ids' => [$lead->id]])->assertStatus(202);
    expect($lead->fresh()->reminders_sent)->toBe(1);
    // Not the first again an hour later; the second 24 hours after the manual one.
    $this->travel(1)->hours();
    expect(crRun())->toBe(0);
    $this->travel(24)->hours();
    expect(crRun())->toBe(1)->and($lead->fresh()->reminders_sent)->toBe(2);
});

it('checks the manual reminder: nothing to send, one at a time, picked carts of this store only, signed in', function () {
    crBalance(10);
    $this->postJson('/api/v1/dashboard/leads/recovery/remind', [])->assertStatus(422)->assertJsonPath('code', 'nothing_to_remind');
    $lead = crLead();
    $this->postJson('/api/v1/dashboard/leads/recovery/remind', ['ids' => ['x']])->assertStatus(422)->assertJsonValidationErrors(['ids.0']);
    $foreign = asTenant(Tenant::factory()->onPlan('pro')->create(), fn () => AbandonedLead::query()->forceCreate(['source' => 'cart', 'customer_phone' => '+201099990000', 'status' => LeadStatus::Open, 'quantity' => 1, 'last_seen_at' => now()])->id);
    $this->postJson('/api/v1/dashboard/leads/recovery/remind', ['ids' => [$foreign]])->assertStatus(422)->assertJsonValidationErrors(['ids.0']);

    Cache::put(SendManualReminders::lockKey($this->owner->tenant_id), true, 60);
    $this->postJson('/api/v1/dashboard/leads/recovery/remind', ['ids' => [$lead->id]])->assertStatus(409)->assertJsonPath('code', 'reminders_running');
    Cache::forget(SendManualReminders::lockKey($this->owner->tenant_id));

    Sanctum::actingAs(User::factory()->for(Tenant::factory()->onPlan('basic')->create())->create()->fresh(['tenant']));
    $this->postJson('/api/v1/dashboard/leads/recovery/remind', [])->assertForbidden();
    app('auth')->forgetGuards();
    $this->withHeaders(['Authorization' => ''])->postJson('/api/v1/dashboard/leads/recovery/remind', [])->assertUnauthorized();
    expect($lead->fresh()->reminders_sent)->toBe(0);
});
