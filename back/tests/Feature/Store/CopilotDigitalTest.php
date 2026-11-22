<?php

declare(strict_types=1);

use App\Ai\Copilot\CopilotContext;
use App\Ai\Copilot\CopilotTools;
use App\Billing\PlanCatalog;
use App\Billing\PlatformSettings;
use App\Models\CopilotChangeItem;
use App\Models\CopilotChangeSet;
use App\Models\CopilotChat;
use App\Models\PlanFeatureValue;
use App\Models\Product;
use App\Models\ProductCode;
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

function dgTool(string $name, array $args): array
{
    $ctx = new CopilotContext(test()->user->tenant->fresh(), test()->user, test()->chat);
    $result = Tenancy::runAs(test()->user->tenant_id, fn () => app(CopilotTools::class)->run($name, $args, $ctx));

    return ['data' => $result->data, 'failed' => $result->failed];
}

it('adds codes from the chat after «نفّذ», keeping them out of the change and its card', function () {
    $id = $this->postJson('/api/v1/dashboard/products', ['name' => 'شدات', 'price' => 50, 'kind' => 'digital', 'delivery_type' => 'codes'])->assertCreated()->json('data.id');

    expect(dgTool('run_action', ['action' => 'products.add_codes', 'args' => ['product_id' => $id, 'codes' => []]])['failed'])->toBeTrue();
    $made = dgTool('run_action', ['action' => 'products.add_codes', 'args' => ['product_id' => $id, 'codes' => ['SECRET-AAA', 'SECRET-BBB'], 'uses' => 2]]);
    expect($made['failed'])->toBeFalse()->and(json_encode($made['data']))->not->toContain('SECRET');

    $setId = $made['data']['change_set_id'];
    $card = $this->getJson("/api/v1/dashboard/ai/copilot/change-sets/{$setId}")->assertOk()->json('data');
    expect(json_encode($card))->not->toContain('SECRET')
        ->and(json_encode(CopilotChangeSet::query()->withoutGlobalScopes()->find($setId)->spec))->not->toContain('SECRET')
        ->and(json_encode(CopilotChangeItem::query()->withoutGlobalScopes()->where('change_set_id', $setId)->get()->toArray()))->not->toContain('SECRET');

    $this->postJson("/api/v1/dashboard/ai/copilot/change-sets/{$setId}/accept")->assertStatus(202);
    expect(asTenant($this->user, fn () => ProductCode::query()->orderBy('position')->get()->map(fn ($c) => [$c->code, $c->uses_left])->all()))->toBe([['SECRET-AAA', 2], ['SECRET-BBB', 2]]);

    // The products resource tells how many are left, never the codes.
    $read = dgTool('find_records', ['resource' => 'products', 'show' => true]);
    expect($read['failed'])->toBeFalse()->and(json_encode($read['data']))->not->toContain('SECRET');
    expect(asTenant($this->user, fn () => Product::query()->find($id)->deliversCodes()))->toBeTrue();
});
