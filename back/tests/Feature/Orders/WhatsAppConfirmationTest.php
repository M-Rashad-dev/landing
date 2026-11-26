<?php

declare(strict_types=1);

use App\Enums\ConfirmState;
use App\Enums\OrderStatus;
use App\Messaging\WhatsApp\WhatsAppTemplates;
use App\Models\Order;
use App\Models\OrderConfirmationSetting;
use App\Models\OutboundMessage;
use App\Models\UserNotification;
use App\Notifications\CustomerNotices;
use App\Orders\WhatsAppConfirmations;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Mail;

const OC_GRAPH = 'https://graph.facebook.com/v23.0';
const OC_PHONE = '+201011112222';

beforeEach(function () {
    Mail::fake();
    config([
        'services.whatsapp.token' => 't', 'services.whatsapp.phone_number_id' => '111', 'services.whatsapp.waba_id' => '222',
        'services.whatsapp.app_secret' => 'test-secret', 'services.whatsapp.graph_url' => OC_GRAPH,
    ]);
    Cache::put('whatsapp:template-status', ['order_confirm_v1' => ['status' => 'APPROVED', 'category' => 'UTILITY'], 'order_confirm_reminder_v1' => ['status' => 'APPROVED', 'category' => 'UTILITY']], now()->addYear());
    $n = 0;
    Http::fake([OC_GRAPH.'/111/messages' => function () use (&$n) {
        $n++;

        return Http::response(['messages' => [['id' => 'wamid.C'.$n]]]);
    }]);
    $this->owner = actingAsOwner();
    $this->owner->tenant->update(['name' => 'متجر حبة']);
});

function ocOn(array $settings = []): void
{
    test()->putJson('/api/v1/dashboard/orders/confirmation-settings', $settings + ['enabled' => true, 'delay_minutes' => 0, 'reminder_hours' => 6, 'final_hours' => 24, 'on_timeout' => 'keep'])->assertOk();
}

function ocOrder(array $attributes = []): Order
{
    $order = asTenant(test()->owner, fn () => Order::factory()->create($attributes + ['order_number' => 1024, 'total' => '450.00', 'customer_phone' => OC_PHONE, 'customer_email' => null]));
    app(CustomerNotices::class)->received($order);

    return asTenant(test()->owner, fn () => $order->fresh());
}

/** The customer presses a reply button (Meta posts it as a «button» message). */
function ocPress(string $payload, string $from = '201011112222')
{
    $raw = json_encode(['object' => 'whatsapp_business_account', 'entry' => [['changes' => [['field' => 'messages', 'value' => ['messages' => [['from' => $from, 'id' => 'wamid.in'.random_int(1, 99999), 'type' => 'button', 'button' => ['payload' => $payload, 'text' => 'x']]]]]]]]]);

    return test()->call('POST', '/api/v1/webhooks/whatsapp', [], [], [], test()->transformHeadersToServerVars(internalHeaders() + ['Content-Type' => 'application/json', 'X-Hub-Signature-256' => 'sha256='.hash_hmac('sha256', $raw, 'test-secret')]), $raw);
}

function ocText(string $text, string $from = '201011112222')
{
    $raw = json_encode(['object' => 'whatsapp_business_account', 'entry' => [['changes' => [['field' => 'messages', 'value' => ['messages' => [['from' => $from, 'id' => 'wamid.t'.random_int(1, 99999), 'type' => 'text', 'text' => ['body' => $text]]]]]]]]]);

    return test()->call('POST', '/api/v1/webhooks/whatsapp', [], [], [], test()->transformHeadersToServerVars(internalHeaders() + ['Content-Type' => 'application/json', 'X-Hub-Signature-256' => 'sha256='.hash_hmac('sha256', $raw, 'test-secret')]), $raw);
}

function ocSentTexts(): array
{
    return collect(Http::recorded())->map(fn ($pair) => $pair[0])->filter(fn (Request $r) => ($r->data()['type'] ?? null) === 'text')->map(fn (Request $r) => $r->data()['text']['body'])->values()->all();
}

it('keeps the settings, checked, to the store', function () {
    $this->getJson('/api/v1/dashboard/orders/confirmation-settings')->assertOk()->assertJsonPath('data.enabled', false)->assertJsonPath('data.available', true);
    $this->putJson('/api/v1/dashboard/orders/confirmation-settings', ['enabled' => true, 'delay_minutes' => 5000, 'final_hours' => 1, 'on_timeout' => 'x'])->assertStatus(422)->assertJsonValidationErrors(['delay_minutes', 'final_hours', 'on_timeout']);
    ocOn(['reminder_hours' => 30]);
    // A reminder after the final wait makes no sense: none.
    $this->getJson('/api/v1/dashboard/orders/confirmation-settings')->assertJsonPath('data.enabled', true)->assertJsonPath('data.reminder_hours', null);

    actingAsOwner();
    $this->getJson('/api/v1/dashboard/orders/confirmation-settings')->assertJsonPath('data.enabled', false);
    app('auth')->forgetGuards();
    $this->withHeaders(['Authorization' => ''])->getJson('/api/v1/dashboard/orders/confirmation-settings')->assertUnauthorized();
});

it('sends the confirmation with three buttons instead of «received», only when on and allowed', function () {
    ocOrder(['order_number' => 1001]);
    Http::assertSent(fn (Request $r) => ($r->data()['template']['name'] ?? null) === WhatsAppTemplates::name('order_received'));

    ocOn();
    $order = ocOrder();
    Http::assertSent(function (Request $r) use ($order): bool {
        $t = $r->data()['template'] ?? null;
        if (($t['name'] ?? null) !== 'order_confirm_v1') {
            return false;
        }
        $buttons = array_values(array_filter($t['components'], fn ($c) => $c['type'] === 'button'));

        return count($buttons) === 3 && $buttons[0]['parameters'][0]['payload'] === app(WhatsAppConfirmations::class)->payload('confirm', $order)
            && array_column($t['components'][0]['parameters'], 'text')[0] === '1024';
    });
    expect($order->confirm_state)->toBe(ConfirmState::Sent);

    // Prepaid → nothing new (cash on delivery needs no opt-in).
    expect(ocOrder(['order_number' => 1031, 'status' => OrderStatus::AwaitingPayment, 'payment_method' => Order::PREPAID])->confirm_state)->toBeNull();
});

it('confirms, cancels or asks for a call from the buttons, with the owner\'s replies', function () {
    ocOn();
    $confirm = ocOrder(['order_number' => 2001]);
    $cancel = ocOrder(['order_number' => 2002]);
    $call = ocOrder(['order_number' => 2003]);
    $c = app(WhatsAppConfirmations::class);

    ocPress($c->payload('confirm', $confirm))->assertOk();
    ocPress($c->payload('cancel', $cancel))->assertOk();
    ocPress($c->payload('call', $call))->assertOk();

    [$a, $b, $d] = asTenant($this->owner, fn () => [$confirm->fresh(), $cancel->fresh(), $call->fresh()]);
    expect($a->status)->toBe(OrderStatus::Confirmed)->and($a->confirm_state)->toBe(ConfirmState::Confirmed)
        ->and($b->status)->toBe(OrderStatus::Cancelled)->and($b->confirm_state)->toBe(ConfirmState::Cancelled)
        ->and($d->status)->toBe(OrderStatus::New)->and($d->confirm_state)->toBe(ConfirmState::NeedsCall);
    expect(asTenant($this->owner, fn () => $b->logs()->latest('id')->value('note')))->toBe(__('confirmations.cancelled_note'));

    $texts = ocSentTexts();
    expect($texts)->toContain('شكرًا لحضرتك، وجاري تجهيز طلبك رقم 2001 من متجر حبة.')
        ->toContain('تم إلغاء طلبك رقم 2002 من متجر حبة.')
        ->toContain('تمام، حد من متجر حبة هيتواصل معاك قريب بخصوص طلبك رقم 2003.');
    // The cancel reply is the only message about it (no «order cancelled» template on top).
    Http::assertNotSent(fn (Request $r) => ($r->data()['template']['name'] ?? null) === WhatsAppTemplates::name('order_cancelled'));
    expect(UserNotification::query()->where('event', 'customer_reply')->count())->toBe(2);

    // Pressing again: told where it is, nothing changes.
    ocPress($c->payload('cancel', $confirm))->assertOk();
    expect(asTenant($this->owner, fn () => $confirm->fresh()->status))->toBe(OrderStatus::Confirmed)
        ->and(ocSentTexts())->toContain('طلبك رقم 2001 من متجر حبة حالته دلوقتي: مؤكد.');
});

it('ignores forged or someone else\'s buttons', function () {
    ocOn();
    $order = ocOrder();
    $c = app(WhatsAppConfirmations::class);

    ocPress('oc:confirm:'.$order->id.':'.str_repeat('0', 20))->assertOk();
    ocPress($c->payload('confirm', $order), '201099999999')->assertOk();

    expect(asTenant($this->owner, fn () => $order->fresh()->status))->toBe(OrderStatus::New);
});

it('sends a written answer to the call center, and anything else to the usual auto-reply', function () {
    ocOn();
    $order = ocOrder();

    ocText('عايز أغيّر العنوان')->assertOk();
    expect(asTenant($this->owner, fn () => $order->fresh()->confirm_state))->toBe(ConfirmState::NeedsCall);

    ocText('مرحبا', '201033334444')->assertOk();
    expect(OutboundMessage::query()->where('recipient', '+201033334444')->where('purpose', 'auto_reply')->exists())->toBeTrue();
});

it('reminds once, then marks «ماردّش» or cancels per the setting', function () {
    ocOn();
    $order = ocOrder();
    $this->travel(7)->hours();
    $this->artisan('orders:confirmations')->assertSuccessful();
    expect(asTenant($this->owner, fn () => $order->fresh()->confirm_state))->toBe(ConfirmState::Reminded);
    Http::assertSent(fn (Request $r) => ($r->data()['template']['name'] ?? null) === 'order_confirm_reminder_v1');

    $this->travel(18)->hours();
    $this->artisan('orders:confirmations')->assertSuccessful();
    expect(asTenant($this->owner, fn () => $order->fresh()))->confirm_state->toBe(ConfirmState::NoReply)->status->toBe(OrderStatus::New);

    asTenant($this->owner, fn () => OrderConfirmationSetting::query()->update(['on_timeout' => 'cancel']));
    $late = ocOrder(['order_number' => 3001]);
    $this->travel(25)->hours();
    $this->artisan('orders:confirmations')->assertSuccessful();
    expect(asTenant($this->owner, fn () => $late->fresh()))->status->toBe(OrderStatus::Cancelled)->confirm_state->toBe(ConfirmState::NoReply);
});

it('puts orders waiting for an answer at the end of the queue, and back when the message fails', function () {
    ocOn();
    $waiting = ocOrder(['order_number' => 4001]);
    asTenant($this->owner, fn () => Order::factory()->create(['order_number' => 4002, 'status' => OrderStatus::New]));

    $this->getJson('/api/v1/dashboard/orders/confirmation-queue')->assertOk()
        ->assertJsonPath('meta.waiting_whatsapp', 1)->assertJsonPath('meta.due', 1)
        ->assertJsonPath('data.1.order_number', 4001)->assertJsonPath('data.1.confirm_state', 'sent');
    $this->getJson('/api/v1/dashboard/orders?confirm=waiting')->assertOk()->assertJsonCount(1, 'data');

    $id = OutboundMessage::query()->where('order_id', $waiting->id)->where('purpose', 'order_confirm')->value('provider_id');
    $raw = json_encode(['object' => 'whatsapp_business_account', 'entry' => [['changes' => [['field' => 'messages', 'value' => ['statuses' => [['id' => $id, 'status' => 'failed', 'timestamp' => '1763200000', 'recipient_id' => '201011112222', 'errors' => [['code' => 131026, 'title' => 'Undeliverable']]]]]]]]]]);
    $this->call('POST', '/api/v1/webhooks/whatsapp', [], [], [], $this->transformHeadersToServerVars(internalHeaders() + ['Content-Type' => 'application/json', 'X-Hub-Signature-256' => 'sha256='.hash_hmac('sha256', $raw, 'test-secret')]), $raw)->assertOk();

    expect(asTenant($this->owner, fn () => $waiting->fresh()->confirm_state))->toBe(ConfirmState::Failed);
});
