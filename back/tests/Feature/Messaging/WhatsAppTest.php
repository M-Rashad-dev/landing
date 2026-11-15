<?php

declare(strict_types=1);

use App\Enums\MessagePurpose;
use App\Enums\MessageStatus;
use App\Jobs\SendWhatsAppAutoReply;
use App\Messaging\WhatsApp\WhatsAppMessenger;
use App\Messaging\WhatsApp\WhatsAppTemplates;
use App\Models\Domain;
use App\Models\Identity;
use App\Models\OutboundMessage;
use App\Models\Store;
use App\Models\Tenant;
use App\Models\User;
use App\Services\PublicSite;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;
use Laravel\Sanctum\Sanctum;

const WA_HOST = 'wa-shop.localhost';
const WA_GRAPH = 'https://graph.facebook.com/v23.0';

function whatsappOn(): void
{
    config([
        'services.whatsapp.token' => 'test-token',
        'services.whatsapp.phone_number_id' => '111',
        'services.whatsapp.waba_id' => '222',
        'services.whatsapp.app_secret' => 'test-secret',
        'services.whatsapp.verify_token' => 'test-verify',
        'services.whatsapp.graph_url' => WA_GRAPH,
    ]);
}

/** A live store on WA_HOST. */
function whatsappStore(): Tenant
{
    $tenant = Tenant::factory()->onPlan('pro')->create(['name' => 'متجر حبة']);
    $user = User::factory()->for($tenant)->create();
    Domain::factory()->for($tenant)->create(['host' => WA_HOST, 'active_host' => WA_HOST]);
    asTenant($tenant, fn () => Identity::factory()->default()->create());
    Sanctum::actingAs($user->fresh(['tenant']));
    test()->postJson('/api/v1/dashboard/store/setup')->assertOk();
    test()->postJson('/api/v1/dashboard/store/design/publish')->assertOk();
    test()->putJson('/api/v1/dashboard/store', ['is_enabled' => true])->assertOk();
    expect(Store::query()->withoutGlobalScopes()->where('tenant_id', $tenant->id)->value('is_enabled'))->toBeTrue();

    return $tenant;
}

function askCode(string $phone = '01012345678')
{
    return test()->postJson('/api/v1/public/store/account/code', ['host' => WA_HOST, 'phone' => $phone, 'ip' => '41.0.0.9'], internalHeaders());
}

/** Meta's webhook as Next relays it: internal key + the signature of the raw body. */
function metaPost(array $payload, ?string $secret = 'test-secret')
{
    $raw = json_encode($payload);
    $headers = internalHeaders() + ['Content-Type' => 'application/json'];
    if ($secret !== null) {
        $headers['X-Hub-Signature-256'] = 'sha256='.hash_hmac('sha256', $raw, $secret);
    }

    return test()->call('POST', '/api/v1/webhooks/whatsapp', [], [], [], test()->transformHeadersToServerVars($headers), $raw);
}

function statusUpdate(string $id, string $status, int $at = 1763200000, array $extra = []): array
{
    return ['object' => 'whatsapp_business_account', 'entry' => [['changes' => [['field' => 'messages', 'value' => [
        'statuses' => [['id' => $id, 'status' => $status, 'timestamp' => (string) $at, 'recipient_id' => '201012345678'] + $extra],
    ]]]]]];
}

it('sends the customer sign-in code on WhatsApp and never shows it', function () {
    whatsappOn();
    $tenant = whatsappStore();
    Http::fake([WA_GRAPH.'/111/messages' => Http::response(['messages' => [['id' => 'wamid.CODE1']]])]);

    askCode('٠١٠١٢٣٤٥٦٧٨')->assertOk()->assertJsonPath('data.channel', 'whatsapp')->assertJsonPath('data.code', null);

    Http::assertSent(function (Request $request): bool {
        $body = $request->data();
        $code = $body['template']['components'][0]['parameters'][0]['text'] ?? '';

        return $request->hasHeader('Authorization', 'Bearer test-token')
            && $body['to'] === '201012345678'
            && $body['template']['name'] === WhatsAppTemplates::CODE
            && $body['template']['language']['code'] === 'ar'
            && preg_match('/^\d{6}$/', $code) === 1
            && $body['template']['components'][1]['parameters'][0]['text'] === $code;
    });

    $log = OutboundMessage::query()->sole();
    expect($log->tenant_id)->toBe($tenant->id)
        ->and($log->recipient)->toBe('+201012345678')
        ->and($log->purpose)->toBe(MessagePurpose::CustomerCode)
        ->and($log->provider_id)->toBe('wamid.CODE1')
        ->and($log->status)->toBe(MessageStatus::Pending);
});

it('tells the customer when the number is not on WhatsApp, and logs the failure', function () {
    whatsappOn();
    whatsappStore();
    Http::fake([WA_GRAPH.'/*' => Http::response(['error' => ['code' => 131026, 'message' => 'Message undeliverable']], 400)]);

    askCode()->assertStatus(422)->assertJsonValidationErrors('phone');

    expect(OutboundMessage::query()->sole())
        ->status->toBe(MessageStatus::Failed)
        ->error_code->toBe('131026');
});

it('answers 503 when Meta cannot be reached', function () {
    whatsappOn();
    whatsappStore();
    Http::fake([WA_GRAPH.'/*' => Http::response(['error' => ['code' => 131000, 'message' => 'Something went wrong']], 500)]);

    askCode()->assertStatus(503)->assertJsonPath('code', 'code_not_sent');
});

it('falls back to the on-screen code when WhatsApp is not configured', function () {
    whatsappStore();
    Http::fake();

    askCode()->assertOk()->assertJsonPath('data.channel', 'screen');
    Http::assertNothingSent();
});

it('answers Meta\'s subscribe check only with our verify token and the internal key', function () {
    whatsappOn();
    $query = ['hub.mode' => 'subscribe', 'hub.verify_token' => 'test-verify', 'hub.challenge' => '98765'];

    $this->get('/api/v1/webhooks/whatsapp?'.http_build_query($query), internalHeaders())->assertOk()->assertContent('98765');
    $this->getJson('/api/v1/webhooks/whatsapp?'.http_build_query(['hub.verify_token' => 'wrong'] + $query), internalHeaders())->assertForbidden();
    $this->getJson('/api/v1/webhooks/whatsapp?'.http_build_query($query))->assertUnauthorized();
});

it('refuses webhook posts without Meta\'s signature', function () {
    whatsappOn();

    metaPost(statusUpdate('wamid.X', 'read'), null)->assertForbidden();
    metaPost(statusUpdate('wamid.X', 'read'), 'another-secret')->assertForbidden();
    $this->postJson('/api/v1/webhooks/whatsapp', statusUpdate('wamid.X', 'read'))->assertUnauthorized();
});

it('follows a message to read and never steps back', function () {
    whatsappOn();
    $message = OutboundMessage::query()->create(['channel' => 'whatsapp', 'recipient' => '+201012345678', 'purpose' => MessagePurpose::CustomerCode, 'provider_id' => 'wamid.A', 'status' => MessageStatus::Pending]);

    metaPost(statusUpdate('wamid.A', 'delivered', 1763200010))->assertOk();
    metaPost(statusUpdate('wamid.A', 'read', 1763200020))->assertOk();
    // A late "sent" changes nothing.
    metaPost(statusUpdate('wamid.A', 'sent', 1763200005))->assertOk();
    // Unknown ids are ignored.
    metaPost(statusUpdate('wamid.UNKNOWN', 'read'))->assertOk();

    $message->refresh();
    expect($message->status)->toBe(MessageStatus::Read)
        ->and($message->delivered_at->timestamp)->toBe(1763200010)
        ->and($message->read_at->timestamp)->toBe(1763200020)
        ->and($message->sent_at)->toBeNull();
});

it('records why Meta failed a message', function () {
    whatsappOn();
    $message = OutboundMessage::query()->create(['channel' => 'whatsapp', 'recipient' => '+201012345678', 'purpose' => MessagePurpose::CustomerCode, 'provider_id' => 'wamid.F', 'status' => MessageStatus::Pending]);

    metaPost(statusUpdate('wamid.F', 'failed', extra: ['errors' => [['code' => 131049, 'title' => 'Not delivered', 'error_data' => ['details' => 'Ecosystem limit']]]]))->assertOk();

    expect($message->refresh())
        ->status->toBe(MessageStatus::Failed)
        ->error_code->toBe('131049')
        ->error_title->toBe('Ecosystem limit')
        ->failed_at->not->toBeNull();
});

it('auto replies once a day to someone who writes to the number', function () {
    whatsappOn();
    Queue::fake();
    $incoming = ['entry' => [['changes' => [['value' => ['messages' => [['from' => '201012345678', 'id' => 'wamid.IN', 'type' => 'text', 'text' => ['body' => 'فين طلبي؟']]]]]]]]];

    metaPost($incoming)->assertOk();
    metaPost($incoming)->assertOk();

    Queue::assertPushed(SendWhatsAppAutoReply::class, 1);
    Queue::assertPushed(SendWhatsAppAutoReply::class, fn (SendWhatsAppAutoReply $job): bool => $job->phone === '+201012345678');
});

it('points the auto reply to the store that last messaged the phone', function () {
    whatsappOn();
    $tenant = whatsappStore();
    OutboundMessage::query()->create(['tenant_id' => $tenant->id, 'channel' => 'whatsapp', 'recipient' => '+201012345678', 'purpose' => MessagePurpose::CustomerCode, 'status' => MessageStatus::Read]);
    Http::fake([WA_GRAPH.'/111/messages' => Http::response(['messages' => [['id' => 'wamid.R']]])]);

    (new SendWhatsAppAutoReply('+201012345678'))->handle(app(WhatsAppMessenger::class), app(PublicSite::class));

    Http::assertSent(fn (Request $request): bool => $request->data()['type'] === 'text'
        && str_contains($request->data()['text']['body'], 'متجر حبة')
        && str_contains($request->data()['text']['body'], WA_HOST));
    expect(OutboundMessage::query()->where('purpose', MessagePurpose::AutoReply)->sole())
        ->tenant_id->toBe($tenant->id)
        ->provider_id->toBe('wamid.R');
});

it('submits only the missing templates, with the platform domain in store links', function () {
    whatsappOn();
    config(['landing.platform_domain' => 'mksab.store', 'landing.app_host' => 'app.mksab.store']);
    Http::fake([
        WA_GRAPH.'/222/message_templates*' => function (Request $request) {
            return $request->method() === 'GET'
                ? Http::response(['data' => [['name' => WhatsAppTemplates::CODE, 'language' => 'ar', 'status' => 'APPROVED', 'category' => 'AUTHENTICATION']]])
                : Http::response(['id' => '1', 'status' => 'PENDING', 'category' => 'UTILITY']);
        },
    ]);

    $this->artisan('whatsapp:templates', ['action' => 'push'])->assertSuccessful();

    $posts = Http::recorded(fn (Request $request): bool => $request->method() === 'POST');
    expect($posts)->toHaveCount(count(WhatsAppTemplates::names()) - 1);
    Http::assertSent(fn (Request $request): bool => $request->method() === 'POST'
        && $request->data()['name'] === WhatsAppTemplates::name('order_received')
        && $request->data()['category'] === 'UTILITY'
        && $request->data()['components'][1]['buttons'][0]['url'] === 'https://mksab.store/t/{{1}}');
    Http::assertSent(fn (Request $request): bool => $request->method() === 'POST'
        && $request->data()['name'] === WhatsAppTemplates::name('merchant_new_order')
        && $request->data()['components'][1]['buttons'][0]['url'] === 'https://app.mksab.store/dashboard/orders/{{1}}');
    Http::assertNotSent(fn (Request $request): bool => $request->method() === 'POST' && $request->data()['name'] === WhatsAppTemplates::CODE);
});

it('refuses the templates command without keys', function () {
    $this->artisan('whatsapp:templates')->assertFailed();
});
