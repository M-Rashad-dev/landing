<?php

declare(strict_types=1);

use App\Actions\Orders\ChangeOrderStatus;
use App\Enums\LeadStatus;
use App\Enums\OrderStatus;
use App\Jobs\DeliverWebhook;
use App\Jobs\NotifyAbandonedLead;
use App\Models\AbandonedLead;
use App\Models\Order;
use App\Models\Webhook;
use App\Models\WebhookDelivery;
use App\Services\Dns\DnsResolver;
use App\Services\Webhooks\WebhookDispatcher;
use App\Services\Webhooks\WebhookSender;
use Illuminate\Http\Client\Request as HttpRequest;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;

const HOOK_URL = 'https://hooks.example.com/orders';
const SHEETS_URL = 'https://script.google.com/macros/s/AKfycbx1234567890abcdefghijklmnop/exec';

beforeEach(function () {
    $this->user = actingAsOwner();
    // hooks.example.com is public, internal.example.com points inside the network.
    app()->instance(DnsResolver::class, new class implements DnsResolver
    {
        public function cnameTargets(string $host): array
        {
            return [];
        }

        public function ipv4(string $host): array
        {
            return match ($host) {
                'hooks.example.com', 'script.google.com' => ['93.184.216.34'],
                'internal.example.com' => ['10.0.0.5'],
                default => [],
            };
        }
    });
});

function hook(array $overrides = []): array
{
    return test()->postJson('/api/v1/dashboard/integrations', array_merge(['kind' => 'webhook', 'name' => 'نظام الشحن', 'url' => HOOK_URL, 'events' => ['order.created', 'order.status_changed']], $overrides))->assertCreated()->json('data');
}

it('creates, edits, toggles, rotates and deletes integrations', function () {
    $created = hook();
    expect($created['secret'])->toHaveLength(48)->and($created['is_active'])->toBeTrue();

    $this->putJson("/api/v1/dashboard/integrations/{$created['id']}", ['name' => 'شحن', 'url' => 'https://hooks.example.com/v2', 'events' => ['lead.created']])->assertOk()
        ->assertJsonPath('data.url', 'https://hooks.example.com/v2')
        ->assertJsonPath('data.events', ['lead.created']);
    $this->putJson("/api/v1/dashboard/integrations/{$created['id']}", ['kind' => 'google_sheets', 'name' => 'x', 'url' => HOOK_URL, 'events' => ['order.created']])->assertStatus(422)->assertJsonValidationErrors(['kind']);
    $this->postJson("/api/v1/dashboard/integrations/{$created['id']}/toggle")->assertOk()->assertJsonPath('data.is_active', false);
    $rotated = $this->postJson("/api/v1/dashboard/integrations/{$created['id']}/rotate-secret")->assertOk()->json('data.secret');
    expect($rotated)->not->toBe($created['secret']);

    $this->getJson('/api/v1/dashboard/integrations')->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('meta.events', ['order.created', 'order.status_changed', 'order.updated', 'lead.created']);
    $this->deleteJson("/api/v1/dashboard/integrations/{$created['id']}")->assertNoContent();
});

it('accepts only public https urls and real Apps Script links', function (string $kind, string $url, bool $ok) {
    $response = $this->postJson('/api/v1/dashboard/integrations', ['kind' => $kind, 'name' => 'x', 'url' => $url, 'events' => ['order.created']]);
    $ok ? $response->assertCreated() : $response->assertStatus(422)->assertJsonValidationErrors(['url']);
})->with([
    ['webhook', HOOK_URL, true],
    ['webhook', 'http://hooks.example.com/x', false],
    ['webhook', 'https://hooks.example.com:8443/x', false],
    ['webhook', 'https://localhost/x', false],
    ['webhook', 'https://127.0.0.1/x', false],
    ['webhook', 'https://192.168.1.10/x', false],
    ['webhook', 'https://user:pass@hooks.example.com/x', false],
    ['google_sheets', SHEETS_URL, true],
    ['google_sheets', 'https://script.google.com/macros/s/short/exec', false],
    ['google_sheets', HOOK_URL, false],
]);

it('validates events and caps integrations per store', function () {
    $this->postJson('/api/v1/dashboard/integrations', ['kind' => 'webhook', 'name' => 'x', 'url' => HOOK_URL, 'events' => ['order.deleted']])->assertStatus(422)->assertJsonValidationErrors(['events.0']);
    $this->postJson('/api/v1/dashboard/integrations', [])->assertStatus(422)->assertJsonValidationErrors(['kind', 'name', 'url', 'events']);
    foreach (range(1, 10) as $_) {
        hook();
    }
    $this->postJson('/api/v1/dashboard/integrations', ['kind' => 'webhook', 'name' => 'x', 'url' => HOOK_URL, 'events' => ['order.created']])->assertStatus(403)->assertJsonPath('code', 'plan_limit_reached');
});

it('signs the test delivery and logs the result', function () {
    Http::fake([HOOK_URL => Http::response(['ok' => true], 200)]);
    $created = hook();

    $this->postJson("/api/v1/dashboard/integrations/{$created['id']}/test")->assertOk()
        ->assertJsonPath('data.delivery.status', 'success')
        ->assertJsonPath('data.delivery.response_code', 200)
        ->assertJsonPath('data.webhook.last_status', 'success');

    Http::assertSent(function (HttpRequest $request) use ($created) {
        $body = $request->body();
        $timestamp = $request->header('X-Webhook-Timestamp')[0];

        return $request->header('X-Webhook-Signature')[0] === 'sha256='.hash_hmac('sha256', $timestamp.'.'.$body, $created['secret'])
            && $request->header('X-Webhook-Event')[0] === 'test'
            && json_decode($body, true)['data']['test'] === true;
    });
    $this->getJson("/api/v1/dashboard/integrations/{$created['id']}/deliveries")->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.event', 'test');
});

it('refuses to deliver to an address inside the network and reports http errors', function () {
    Http::fake(['*' => Http::response('nope', 500)]);
    $internal = asTenant($this->user, fn () => Webhook::query()->create(['kind' => 'webhook', 'name' => 'x', 'url' => 'https://internal.example.com/hook', 'secret' => str_repeat('s', 48), 'events' => ['order.created']]));

    $this->postJson("/api/v1/dashboard/integrations/{$internal->id}/test")->assertOk()
        ->assertJsonPath('data.delivery.status', 'failed')
        ->assertJsonPath('data.delivery.error', __('integrations.blocked_address'))
        ->assertJsonPath('data.webhook.failures_count', 1);
    Http::assertNothingSent();

    $public = hook();
    $this->postJson("/api/v1/dashboard/integrations/{$public['id']}/test")->assertOk()->assertJsonPath('data.delivery.error', __('integrations.http_error', ['code' => 500]));
});

it('sends order events to subscribed active integrations only', function () {
    Queue::fake();
    hook(['events' => ['order.created']]);
    $statusHook = hook(['events' => ['order.status_changed']]);
    $off = hook(['events' => ['order.status_changed']]);
    $this->postJson("/api/v1/dashboard/integrations/{$off['id']}/toggle");

    $order = asTenant($this->user, fn () => Order::factory()->create(['status' => OrderStatus::New]));
    asTenant($this->user, fn () => app(ChangeOrderStatus::class)->handle($order, OrderStatus::Confirmed, null, $this->user->id));

    Queue::assertPushed(DeliverWebhook::class, 1);
    Queue::assertPushed(DeliverWebhook::class, fn (DeliverWebhook $job) => $job->webhookId === $statusHook['id']
        && $job->event === 'order.status_changed'
        && $job->data['order']['status'] === 'confirmed'
        && $job->data['previous_status'] === 'new'
        && $job->data['order']['number'] === $order->order_number);
});

it('retries failed deliveries and stops after four attempts', function () {
    Http::fake([HOOK_URL => Http::sequence()->push('down', 503)->push('down', 503)->push(['ok' => true], 200)]);
    $created = hook();
    $order = asTenant($this->user, fn () => Order::factory()->create());

    foreach ([1, 2, 3] as $attempt) {
        $job = new DeliverWebhook($this->user->tenant_id, $created['id'], 'order.created', ['order' => ['number' => $order->order_number]]);
        $fake = $job->withFakeQueueInteractions();
        $fake->job->attempts = $attempt;
        $fake->handle(app(WebhookSender::class));
        $attempt < 3 ? $fake->assertReleased(DeliverWebhook::RETRY_DELAYS[$attempt - 1]) : $fake->assertNotReleased();
    }

    expect(asTenant($this->user, fn () => WebhookDelivery::query()->orderBy('id')->pluck('status')->all()))->toBe(['failed', 'failed', 'success'])
        ->and(asTenant($this->user, fn () => Webhook::query()->find($created['id'])->failures_count))->toBe(0);
});

it('reports an abandoned form only if no order follows within 30 minutes', function () {
    Queue::fake();
    hook(['events' => ['lead.created']]);
    $lead = asTenant($this->user, fn () => AbandonedLead::query()->create(['customer_phone' => '+201001112223', 'status' => LeadStatus::Open]));
    asTenant($this->user, fn () => app(WebhookDispatcher::class)->lead($lead));
    Queue::assertPushed(NotifyAbandonedLead::class, fn ($job) => $job->leadId === $lead->id && $job->delay !== null);

    // Still open after 30 minutes → lead.created; converted → nothing.
    (new NotifyAbandonedLead($this->user->tenant_id, $lead->id))->handle(app(WebhookDispatcher::class));
    Queue::assertPushed(DeliverWebhook::class, fn (DeliverWebhook $job) => $job->event === 'lead.created' && $job->data['lead']['phone'] === '+201001112223');

    asTenant($this->user, fn () => $lead->update(['status' => LeadStatus::Converted]));
    (new NotifyAbandonedLead($this->user->tenant_id, $lead->id))->handle(app(WebhookDispatcher::class));
    Queue::assertPushed(DeliverWebhook::class, 1);
});

it('keeps integrations per store and needs a token', function () {
    $created = hook();
    $this->app['auth']->forgetGuards();
    $this->getJson('/api/v1/dashboard/integrations', ['Authorization' => ''])->assertUnauthorized();

    actingAsOwner(createOwner());
    $this->getJson('/api/v1/dashboard/integrations')->assertOk()->assertJsonCount(0, 'data');
    $this->putJson("/api/v1/dashboard/integrations/{$created['id']}", ['name' => 'x', 'url' => HOOK_URL, 'events' => ['order.created']])->assertNotFound();
    $this->postJson("/api/v1/dashboard/integrations/{$created['id']}/test")->assertNotFound();
    $this->getJson("/api/v1/dashboard/integrations/{$created['id']}/deliveries")->assertNotFound();
    $this->deleteJson("/api/v1/dashboard/integrations/{$created['id']}")->assertNotFound();
});
