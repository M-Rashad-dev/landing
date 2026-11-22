<?php

declare(strict_types=1);

use App\Ai\Copilot\CopilotContext;
use App\Ai\Copilot\CopilotTools;
use App\Billing\PlanCatalog;
use App\Billing\PlatformSettings;
use App\Enums\OrderStatus;
use App\Models\CopilotChangeSet;
use App\Models\CopilotChat;
use App\Models\Order;
use App\Models\PlanFeatureValue;
use App\Models\Shipment;
use App\Tenancy\Tenancy;
use Illuminate\Support\Facades\Mail;

beforeEach(function () {
    Mail::fake();
    app(PlatformSettings::class)->save(['ai_features' => ['support' => false, 'designer' => false, 'copilot' => true], 'ai_usd_rate' => 50, 'ai_margin_percent' => 10, 'ai_welcome_credit' => 0]);
    PlanFeatureValue::query()->updateOrCreate(['plan_key' => 'pro', 'entitlement' => 'ai'], ['value' => 1]);
    PlanCatalog::flush();
    $this->user = actingAsOwner();
    $this->user->tenant->forceFill(['plan_key' => 'pro'])->save();
    PlanCatalog::flush();
    $this->chat = asTenant($this->user, fn () => CopilotChat::query()->create(['user_id' => $this->user->id]));
});

function shipTool(string $name, array $args): array
{
    $ctx = new CopilotContext(test()->user->tenant->fresh(), test()->user, test()->chat);
    $result = Tenancy::runAs(test()->user->tenant_id, fn () => app(CopilotTools::class)->run($name, $args, $ctx));

    return ['data' => $result->data, 'failed' => $result->failed];
}

it('ships confirmed orders from the chat after «نفّذ», listing the ones that can\'t go and why', function () {
    expect(shipTool('run_action', ['action' => 'shipping.ship_orders', 'args' => ['selector' => ['ids' => [1]]]])['failed'])->toBeTrue();

    $this->postJson('/api/v1/dashboard/shipping/carriers/bosta', ['api_key' => 'live-key-123'])->assertOk();
    [$good, $new] = asTenant($this->user, fn () => [
        Order::factory()->create(['status' => OrderStatus::Confirmed, 'city' => 'المعادي', 'address' => 'شارع 9 المعادي']),
        Order::factory()->create(['status' => OrderStatus::New, 'city' => 'المعادي', 'address' => 'شارع 9 المعادي']),
    ]);

    $made = shipTool('run_action', ['action' => 'shipping.ship_orders', 'args' => ['selector' => ['ids' => [$good->id, $new->id]]]]);
    expect($made['failed'])->toBeFalse();
    $id = $made['data']['change_set_id'];
    $card = $this->getJson("/api/v1/dashboard/ai/copilot/change-sets/{$id}")->assertOk()->json('data');
    expect($card['summary'])->toContain('1 طلب')
        ->and(asTenant($this->user, fn () => Shipment::query()->count()))->toBe(0);

    $this->postJson("/api/v1/dashboard/ai/copilot/change-sets/{$id}/accept")->assertStatus(202);

    expect(CopilotChangeSet::query()->withoutGlobalScopes()->find($id)->status)->toBe('applied')
        ->and(asTenant($this->user, fn () => Shipment::query()->pluck('order_id')->all()))->toBe([$good->id]);
});
