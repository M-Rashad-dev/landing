<?php

declare(strict_types=1);

use App\Ai\Copilot\CopilotContext;
use App\Ai\Copilot\CopilotTools;
use App\Enums\OrderStatus;
use App\Jobs\DeliverCustomerNotice;
use App\Jobs\DeliverWebhook;
use App\Jobs\VerifyDomain;
use App\Jobs\WarmSsl;
use App\Models\CopilotChangeSet;
use App\Models\CopilotChat;
use App\Models\Domain;
use App\Models\Order;
use App\Models\Tenant;
use App\Models\User;
use App\Models\Webhook;
use App\Models\WebhookDelivery;
use App\Services\Dns\DnsResolver;
use App\Tenancy\Tenancy;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;
use Laravel\Sanctum\Sanctum;

beforeEach(function () {
    // What goes out of the store is faked; the copilot's own jobs run.
    Queue::fake([DeliverCustomerNotice::class, DeliverWebhook::class, VerifyDomain::class, WarmSsl::class]);
    $this->tenant = Tenant::factory()->onPlan('pro')->create();
    $this->user = User::factory()->for($this->tenant)->create();
    Sanctum::actingAs($this->user->fresh(['tenant']));
    $this->chat = asTenant($this->tenant->id, fn () => CopilotChat::query()->create(['user_id' => $this->user->id]));
    app()->instance(DnsResolver::class, new class implements DnsResolver
    {
        public function cnameTargets(string $host): array
        {
            return [];
        }

        public function ipv4(string $host): array
        {
            return [];
        }
    });
});

function opsTool(string $name, array $args): array
{
    $ctx = new CopilotContext(test()->tenant, test()->user, test()->chat);
    $result = Tenancy::runAs(test()->tenant->id, fn () => app(CopilotTools::class)->run($name, $args, $ctx));

    return ['data' => $result->data, 'failed' => $result->failed, 'blocks' => $ctx->blocks(), 'json' => $result->toJson()];
}

function opsOrder(OrderStatus $status, string $governorate = 'القاهرة'): Order
{
    return asTenant(test()->tenant->id, fn () => Order::factory()->create(['status' => $status, 'governorate' => $governorate]));
}

function accept(int $id): void
{
    test()->postJson("/api/v1/dashboard/ai/copilot/change-sets/{$id}/accept")->assertStatus(202);
}

it('confirms many orders through the orders page\'s own action, counting the side effects, with no undo', function () {
    $cairo = [opsOrder(OrderStatus::New), opsOrder(OrderStatus::New)];
    $giza = opsOrder(OrderStatus::New, 'الجيزة');
    asTenant($this->tenant->id, fn () => Webhook::query()->create(['kind' => 'webhook', 'name' => 'شيت', 'url' => 'https://hooks.example.com/x', 'events' => ['order.status_changed'], 'secret' => str_repeat('s', 48), 'is_active' => true]));

    $proposal = opsTool('run_action', ['action' => 'orders.change_status', 'args' => ['selector' => ['filters' => ['status' => ['new'], 'governorate' => 'القاهرة']], 'to' => 'confirmed']]);

    $id = $proposal['data']['change_set_id'];
    expect($proposal['data']['records'])->toBe(2)
        ->and($proposal['data']['reversible'])->toBeFalse()
        ->and(implode(' ', $proposal['data']['side_effects']))->toContain('2 إشعار')->not->toContain('رسالة')
        ->and(asTenant($this->tenant->id, fn () => Order::query()->where('status', OrderStatus::Confirmed)->count()))->toBe(0);
    $card = $this->getJson("/api/v1/dashboard/ai/copilot/change-sets/{$id}")->json('data');
    expect($card['items'][0]['after']['status'])->toBe('مؤكد')->and($card['side_effects'])->toHaveCount(1);

    accept($id);

    $statuses = asTenant($this->tenant->id, fn () => Order::query()->with('logs')->get()->keyBy('id'));
    expect($statuses[$cairo[0]->id]->status)->toBe(OrderStatus::Confirmed)
        ->and($statuses[$cairo[1]->id]->status)->toBe(OrderStatus::Confirmed)
        ->and($statuses[$giza->id]->status)->toBe(OrderStatus::New)
        ->and($statuses[$cairo[0]->id]->logs->last()->changed_by)->toBe($this->user->id)
        ->and($this->getJson("/api/v1/dashboard/ai/copilot/change-sets/{$id}")->json('data.can.revert'))->toBeFalse();
    $this->postJson("/api/v1/dashboard/ai/copilot/change-sets/{$id}/revert")->assertStatus(422);
});

it('skips orders that can\'t move to that status, and orders changed by hand since the preview', function () {
    $new = opsOrder(OrderStatus::New);
    $delivered = opsOrder(OrderStatus::Delivered);
    $moved = opsOrder(OrderStatus::New);

    $proposal = opsTool('run_action', ['action' => 'orders.change_status', 'args' => ['selector' => ['ids' => [$new->id, $delivered->id, $moved->id]], 'to' => 'cancelled']]);
    expect($proposal['data']['records'])->toBe(2)
        ->and($proposal['data']['skipped_invalid'])->toBe(1)
        ->and(implode(' ', $proposal['data']['side_effects']))->toContain('رسالة للعملاء')->toContain('المخزون');

    asTenant($this->tenant->id, fn () => Order::query()->whereKey($moved->id)->update(['status' => OrderStatus::Fake]));
    accept($proposal['data']['change_set_id']);

    $after = asTenant($this->tenant->id, fn () => Order::query()->pluck('status', 'id'));
    expect($after[$new->id])->toBe(OrderStatus::Cancelled)
        ->and($after[$delivered->id])->toBe(OrderStatus::Delivered)
        ->and($after[$moved->id])->toBe(OrderStatus::Fake)
        ->and(CopilotChangeSet::query()->withoutGlobalScopes()->find($proposal['data']['change_set_id'])->skipped_count)->toBe(2);
});

it('adds a pending domain with its DNS records, checks it, and paces the checks', function () {
    $added = opsTool('run_action', ['action' => 'domains.add', 'args' => ['host' => 'mystore.localtest.me']]);

    expect($added['failed'])->toBeFalse()
        ->and($added['data']['domain'])->toMatchArray(['host' => 'mystore.localtest.me', 'status' => 'pending'])
        ->and($added['data']['domain'])->toHaveKey('instructions')
        ->and($added['blocks'][0]['href'])->toBe('/dashboard/settings/domains')
        ->and(asTenant($this->tenant->id, fn () => Domain::query()->where('host', 'mystore.localtest.me')->value('is_primary')))->toBeFalse();

    $checked = opsTool('run_action', ['action' => 'domains.verify', 'args' => ['host' => 'mystore.localtest.me']]);
    expect($checked['data']['domain']['status'])->toBe('pending');

    for ($i = 0; $i < 10; $i++) {
        opsTool('run_action', ['action' => 'domains.check_ssl', 'args' => ['host' => 'mystore.localtest.me']]);
    }
    expect(opsTool('run_action', ['action' => 'domains.verify', 'args' => ['host' => 'mystore.localtest.me']])['data']['error'])->toContain('Too many')
        ->and(opsTool('run_action', ['action' => 'domains.make_primary', 'args' => []])['data']['error'])->toContain('Unknown action');
});

it('tests an integration and shows its attempts without the secret, the URL or the payload', function () {
    Http::fake(['*' => Http::response('nope', 500)]);
    $hook = asTenant($this->tenant->id, fn () => Webhook::query()->create(['kind' => 'webhook', 'name' => 'نظامي', 'url' => 'https://hooks.example.com/secret-path', 'events' => ['order.created'], 'secret' => str_repeat('k', 48), 'is_active' => true]));

    $test = opsTool('run_action', ['action' => 'webhooks.test', 'args' => ['webhook_id' => $hook->id]]);
    $hooks = opsTool('find_records', ['resource' => 'webhooks', 'show' => true]);
    $tries = opsTool('find_records', ['resource' => 'webhook_deliveries', 'filters' => ['webhook_id' => $hook->id]]);

    expect($test['data']['test']['status'])->toBe('failed')
        ->and($test['json'].$hooks['json'].$tries['json'])->not->toContain(str_repeat('k', 48))->not->toContain('secret-path')
        ->and($tries['data']['total'])->toBe(asTenant($this->tenant->id, fn () => WebhookDelivery::query()->count()))
        ->and($tries['data']['rows'][0])->not->toHaveKey('payload')
        // The merchant's own table shows the URL.
        ->and($hooks['blocks'][0]['rows'][0]['url'])->toBe('https://hooks.example.com/secret-path');
});

it('reads the pixels and points to their page', function () {
    $pixels = opsTool('run_action', ['action' => 'pixels.show', 'args' => []]);

    expect($pixels['data'])->toHaveKey('pixels')->and($pixels['blocks'][0]['href'])->toBe('/dashboard/settings/pixels');
});

it('tells the support assistant to send store work to the copilot', function () {
    expect((string) file_get_contents(resource_path('prompts/support-assistant.md')))->toContain('«✨ المساعد»');
});
