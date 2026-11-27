<?php

declare(strict_types=1);

use App\Ai\AiWallets;
use App\Ai\Copilot\CopilotContext;
use App\Ai\Copilot\CopilotTools;
use App\Billing\PlanCatalog;
use App\Billing\PlatformSettings;
use App\Jobs\RevalidateTenantHosts;
use App\Models\CopilotChangeSet;
use App\Models\CopilotChat;
use App\Models\PlanFeatureValue;
use App\Models\Product;
use App\Models\SpecGroup;
use App\Models\Tenant;
use App\Models\User;
use App\Tenancy\Tenancy;
use Illuminate\Support\Facades\Queue;
use Laravel\Sanctum\Sanctum;

/*
 * «المواصفات» in the store copilot (docs/plans/tekno/PLAN.md §1.6): fill empty rows from the products' texts (cost
 * first, preview, apply, undo), spec groups readable / editable / creatable.
 */

beforeEach(function () {
    Queue::fake([RevalidateTenantHosts::class]);
    app(PlatformSettings::class)->save(['ai_features' => ['support' => false, 'designer' => false, 'copilot' => true], 'ai_usd_rate' => 50, 'ai_margin_percent' => 10, 'ai_welcome_credit' => 0]);
    PlanFeatureValue::query()->updateOrCreate(['plan_key' => 'pro', 'entitlement' => 'ai'], ['value' => 1]);
    PlanCatalog::flush();
    $this->tenant = Tenant::factory()->onPlan('pro')->create();
    $this->user = User::factory()->for($this->tenant)->create();
    Sanctum::actingAs($this->user->fresh(['tenant']));
    $this->chat = asTenant($this->tenant->id, fn () => CopilotChat::query()->create(['user_id' => $this->user->id]));
});

function csTool(string $name, array $args): array
{
    $ctx = new CopilotContext(test()->tenant, test()->user, test()->chat);
    $result = Tenancy::runAs(test()->tenant->id, fn () => app(CopilotTools::class)->run($name, $args, $ctx));

    return ['data' => $result->data, 'failed' => $result->failed];
}

function csSet(int $id): CopilotChangeSet
{
    return CopilotChangeSet::query()->withoutGlobalScopes()->findOrFail($id);
}

/** @return list<string|null> the values of the product's first table */
function csValues(int $productId): array
{
    return array_column(test()->getJson("/api/v1/dashboard/products/{$productId}")->assertOk()->json('data.specs.0.rows'), 'value');
}

function csLaptop(string $description, array $values = [null, null, null]): int
{
    return test()->postJson('/api/v1/dashboard/products', ['name' => 'لابتوب 14', 'price' => 24999, 'description' => $description, 'specs' => [
        ['name' => 'لابتوب', 'rows' => [['label' => 'المعالج', 'value' => $values[0]], ['label' => 'الرامات', 'value' => $values[1]], ['label' => 'الوزن', 'value' => $values[2]]]],
    ]])->assertCreated()->json('data.id');
}

it('fills empty spec rows from the descriptions after the estimate and the preview, and undoes it', function () {
    app(AiWallets::class)->credit($this->tenant, 10000, 'topup');
    $a = csLaptop("لابتوب خفيف.\n- المعالج: Core i5-1335U\n- الرامات: 16GB DDR5");
    // Its processor is already filled: only the empty rows are asked for; nothing says its weight.
    $b = csLaptop("الرامات: 8GB\nالمعالج: Core i3", ['Core i7', null, null]);
    $nothing = csLaptop('لابتوب ممتاز.');
    $noSpecs = $this->postJson('/api/v1/dashboard/products', ['name' => 'ماوس', 'price' => 450, 'description' => 'المعالج: x'])->assertCreated()->json('data.id');

    $estimate = csTool('run_action', ['action' => 'products.fill_specs', 'args' => []]);
    $id = $estimate['data']['change_set_id'];
    // Products without spec tables are left out.
    expect($estimate['data']['records'])->toBe(3)->and(csSet($id)->status)->toBe('estimate');

    $this->postJson("/api/v1/dashboard/ai/copilot/change-sets/{$id}/accept")->assertStatus(202);
    $set = csSet($id);
    expect($set->status)->toBe('proposed', (string) $set->error)->and($set->target)->toBe('products.fill_specs')
        ->and(csValues($a))->toBe([null, null, null]);

    $card = $this->getJson("/api/v1/dashboard/ai/copilot/change-sets/{$id}")->assertOk()->json('data');
    expect($card['columns'][0]['label'])->toBe('المواصفات')
        ->and(collect($card['items'])->firstWhere('entity_id', $a)['after']['specs'])->toContain('لابتوب: المعالج: Core i5-1335U')
        ->and(collect($card['items'])->firstWhere('entity_id', $nothing)['status'])->toBe('failed');

    $this->postJson("/api/v1/dashboard/ai/copilot/change-sets/{$id}/accept")->assertStatus(202);
    expect(csSet($id)->status)->toBe('applied')
        ->and(csValues($a))->toBe(['Core i5-1335U', '16GB DDR5', null])
        // The merchant's own value stays; only the empty row was filled.
        ->and(csValues($b))->toBe(['Core i7', '8GB', null])
        ->and(csValues($nothing))->toBe([null, null, null])
        ->and($this->getJson("/api/v1/dashboard/products/{$noSpecs}")->json('data.specs'))->toBe([]);

    // «تراجع»: the rows the merchant didn't touch since go back to empty.
    $this->putJson("/api/v1/dashboard/products/{$b}", ['name' => 'لابتوب 14', 'price' => 24999, 'specs' => [
        ['name' => 'لابتوب', 'rows' => [['label' => 'المعالج', 'value' => 'Core i7'], ['label' => 'الرامات', 'value' => '12GB'], ['label' => 'الوزن', 'value' => null]]],
    ]])->assertOk();
    $revert = $this->postJson("/api/v1/dashboard/ai/copilot/change-sets/{$id}/revert")->assertStatus(202)->json('data.id');
    expect(csSet($revert)->status)->toBe('applied')
        ->and(csValues($a))->toBe([null, null, null])
        ->and(csValues($b))->toBe(['Core i7', '12GB', null]);
});

it('says so when no product has an empty spec row', function () {
    $this->postJson('/api/v1/dashboard/products', ['name' => 'ماوس', 'price' => 450])->assertCreated();
    expect(csTool('run_action', ['action' => 'products.fill_specs', 'args' => []])['data']['error'])->toContain('empty spec row');
});

it('reads products specs and edits spec groups like any record', function () {
    csLaptop('', ['Core i5', null, null]);
    $found = csTool('find_records', ['resource' => 'products', 'show' => true]);
    expect(json_encode($found['data'], JSON_UNESCAPED_UNICODE))->toContain('لابتوب: 3 صف (1 متعبّية)');

    $group = $this->postJson('/api/v1/dashboard/spec-groups', ['name' => 'لابتوب', 'rows' => [['label' => 'المعالج', 'in_card' => true], ['label' => 'الرامات']]])->assertCreated()->json('data.id');
    $listed = csTool('find_records', ['resource' => 'spec_groups', 'show' => true]);
    expect(json_encode($listed['data'], JSON_UNESCAPED_UNICODE))->toContain('المعالج، الرامات');

    $change = csTool('update_records', ['resource' => 'spec_groups', 'selector' => ['ids' => [$group]], 'changes' => ['rows' => ['append' => '، الوزن']]]);
    $this->postJson("/api/v1/dashboard/ai/copilot/change-sets/{$change['data']['change_set_id']}/accept")->assertStatus(202);

    $rows = $this->getJson("/api/v1/dashboard/spec-groups/{$group}")->assertOk()->json('data.rows');
    // A label kept keeps its flags.
    expect($rows)->toBe([['label' => 'المعالج', 'in_card' => true, 'filterable' => false], ['label' => 'الرامات', 'in_card' => false, 'filterable' => false], ['label' => 'الوزن', 'in_card' => false, 'filterable' => false]]);
});

it('creates spec groups after the merchant approves', function () {
    $proposal = csTool('run_action', ['action' => 'spec_groups.create', 'args' => ['groups' => [
        ['name' => 'لابتوب', 'rows' => [['label' => 'المعالج', 'in_card' => true, 'filterable' => true], ['label' => 'الرامات']]],
        ['name' => 'الضمان', 'rows' => [['label' => 'المدة']]],
    ]]]);
    $id = $proposal['data']['change_set_id'];
    expect(asTenant($this->tenant->id, fn () => SpecGroup::query()->count()))->toBe(0);

    $this->postJson("/api/v1/dashboard/ai/copilot/change-sets/{$id}/accept")->assertStatus(202);
    expect(csSet($id)->status)->toBe('applied');
    $groups = $this->getJson('/api/v1/dashboard/spec-groups')->assertOk()->json('data');
    expect(array_column($groups, 'name'))->toBe(['لابتوب', 'الضمان'])->and($groups[0]['rows_count'])->toBe(2);

    // Checked like the dashboard: a taken name and five card rows are refused before anything is proposed.
    $bad = csTool('run_action', ['action' => 'spec_groups.create', 'args' => ['groups' => [
        ['name' => 'لابتوب', 'rows' => [['label' => 'س']]],
        ['name' => 'جديدة', 'rows' => array_map(fn ($i) => ['label' => "صف {$i}", 'in_card' => true], range(1, 5))],
    ]]]);
    expect(json_encode($bad['data'], JSON_UNESCAPED_UNICODE))->toContain('groups.0')->toContain('groups.1');
});
