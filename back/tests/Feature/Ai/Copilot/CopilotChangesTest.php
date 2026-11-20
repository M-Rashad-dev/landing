<?php

declare(strict_types=1);

use App\Ai\Copilot\Changes\ValueOps;
use App\Ai\Copilot\Contracts\Field;
use App\Ai\Copilot\CopilotContext;
use App\Ai\Copilot\CopilotTools;
use App\Ai\Copilot\Support\CopilotToolError;
use App\Ai\Copilot\Support\FormRequestRunner;
use App\Billing\PlanCatalog;
use App\Http\Requests\Dashboard\ProductRequest;
use App\Models\Category;
use App\Models\CopilotChangeItem;
use App\Models\CopilotChangeSet;
use App\Models\CopilotChat;
use App\Models\CopilotMessage;
use App\Models\PlanFeatureValue;
use App\Models\Product;
use App\Models\StockMovement;
use App\Models\Tenant;
use App\Models\User;
use App\Tenancy\Tenancy;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Laravel\Sanctum\Sanctum;

beforeEach(function () {
    $this->tenant = Tenant::factory()->onPlan('pro')->create();
    $this->user = User::factory()->for($this->tenant)->create();
    Sanctum::actingAs($this->user->fresh(['tenant']));
    $this->chat = asTenant($this->tenant->id, fn () => CopilotChat::query()->create(['user_id' => $this->user->id]));
});

/** Runs one copilot tool inside the store, as the engine does (with the page context given). */
function changeTool(string $name, array $args, array $page = []): array
{
    $ctx = new CopilotContext(test()->tenant, test()->user, test()->chat, null, $page);
    $result = Tenancy::runAs(test()->tenant->id, fn () => app(CopilotTools::class)->run($name, $args, $ctx));

    return ['data' => $result->data, 'failed' => $result->failed, 'blocks' => $ctx->blocks()];
}

function product(array $attributes = []): Product
{
    return asTenant(test()->tenant->id, fn () => Product::factory()->create($attributes));
}

function fresh(Product $product): Product
{
    return asTenant(test()->tenant->id, fn () => Product::query()->findOrFail($product->id));
}

function changeSet(int $id): CopilotChangeSet
{
    return CopilotChangeSet::query()->withoutGlobalScopes()->findOrFail($id);
}

function priceUp(array $selector, float $percent, ?array $round = null): array
{
    return changeTool('update_records', ['resource' => 'products', 'selector' => $selector, 'changes' => ['price' => ['percent' => $percent] + ($round ? ['round' => $round] : [])]]);
}

it('does the price math in piastres, with rounding, never below zero', function () {
    $price = Field::money('price')->bulk()->nullable();
    $op = fn (string $from, array $op) => ValueOps::apply($price, $from, $op);

    expect($op('100.00', ['percent' => 30]))->toBe('130.00')
        ->and($op('99.99', ['percent' => 15]))->toBe('114.99')
        ->and($op('132.40', ['percent' => 0, 'round' => ['to' => 5, 'mode' => 'nearest']]))->toBe('130.00')
        ->and($op('132.40', ['percent' => 0, 'round' => ['to' => 5, 'mode' => 'up']]))->toBe('135.00')
        ->and($op('137.50', ['percent' => 0, 'round' => ['to' => 5, 'mode' => 'down']]))->toBe('135.00')
        ->and($op('200.00', ['add' => -20]))->toBe('180.00')
        ->and($op('50.00', ['add' => -1000]))->toBe('0.00')
        ->and($op('50.00', ['percent' => -10]))->toBe('45.00')
        ->and($op('50.00', ['clear' => true]))->toBeNull()
        ->and(ValueOps::apply(Field::text('name'), 'حذاء قديم', ['replace' => ['find' => 'قديم', 'with' => 'جديد']]))->toBe('حذاء جديد')
        ->and(ValueOps::apply(Field::text('name'), 'حذاء', ['append' => ' 2026']))->toBe('حذاء 2026')
        ->and(ValueOps::apply(Field::ids('category_ids'), [3, 1], ['add' => [2, 3]]))->toBe([1, 2, 3])
        ->and(ValueOps::apply(Field::ids('category_ids'), [3, 1], ['remove' => [3]]))->toBe([1])
        ->and(ValueOps::apply(Field::int('stock'), 5, ['add' => 10]))->toBe(15);

    foreach ([['set' => 1, 'add' => 2], ['multiply' => 2], ['percent' => -100], ['percent' => 'x'], ['percent' => 5, 'round' => ['to' => 3]]] as $bad) {
        expect(fn () => ValueOps::check($price, $bad))->toThrow(CopilotToolError::class);
    }
});

it('runs the dashboard\'s own request rules, hooks and route model', function () {
    $taken = product(['slug' => 'taken']);
    $mine = product(['slug' => 'mine']);

    $ok = Tenancy::runAs($this->tenant->id, fn () => FormRequestRunner::run(ProductRequest::class, ['name' => ' <b>حذاء</b> ', 'price' => '100'], $this->user));
    expect($ok->validated()['name'])->toBe('حذاء');

    $hook = fn () => Tenancy::runAs($this->tenant->id, fn () => FormRequestRunner::run(ProductRequest::class, ['name' => 'x', 'price' => '100', 'compare_at_price' => '90'], $this->user));
    expect($hook)->toThrow(ValidationException::class);

    // Unique slug ignores the product itself, not another one.
    Tenancy::runAs($this->tenant->id, fn () => FormRequestRunner::run(ProductRequest::class, ['name' => 'x', 'price' => '10', 'slug' => 'mine'], $this->user, 'product', $mine));
    expect(fn () => Tenancy::runAs($this->tenant->id, fn () => FormRequestRunner::run(ProductRequest::class, ['name' => 'x', 'price' => '10', 'slug' => 'taken'], $this->user, 'product', $mine)))
        ->toThrow(ValidationException::class);
    expect($taken->id)->not->toBe($mine->id);
});

it('creates products at once as drafts, checks them all first, and publishes on «انشر»', function () {
    $bad = changeTool('create_records', ['resource' => 'products', 'items' => [['name' => 'تيشيرت', 'price' => 200], ['name' => 'بنطلون']]]);
    expect($bad['failed'])->toBeTrue()->and($bad['data']['fields'])->toHaveKey('items.1')
        ->and(asTenant($this->tenant->id, fn () => Product::query()->count()))->toBe(0);

    $made = changeTool('create_records', ['resource' => 'products', 'items' => [['name' => 'تيشيرت', 'price' => 200, 'is_active' => true], ['name' => 'بنطلون', 'price' => 350]]]);

    $setId = $made['data']['change_set_id'];
    expect($made['blocks'])->toBe([['type' => 'change_set', 'id' => $setId]])
        ->and(asTenant($this->tenant->id, fn () => Product::query()->where('is_active', false)->count()))->toBe(2)
        ->and(changeSet($setId)->status)->toBe('proposed');
    // They show in the products page as drafts.
    expect($this->getJson('/api/v1/dashboard/products?status=inactive')->assertOk()->json('meta.total'))->toBe(2);

    $this->postJson("/api/v1/dashboard/ai/copilot/change-sets/{$setId}/accept")->assertStatus(202);

    expect(asTenant($this->tenant->id, fn () => Product::query()->where('is_active', true)->count()))->toBe(2)
        ->and(changeSet($setId)->status)->toBe('applied')
        ->and(changeSet($setId)->applied_count)->toBe(2);
    $note = CopilotMessage::query()->withoutGlobalScopes()->where('chat_id', $this->chat->id)->latest('id')->first();
    expect($note->blocks)->toBe([['type' => 'change_set', 'id' => $setId]])->and($note->text)->toContain('2');
});

it('respects the plan limit before creating anything', function () {
    PlanFeatureValue::query()->updateOrCreate(['plan_key' => 'pro', 'entitlement' => 'products'], ['value' => 1]);
    PlanCatalog::flush();

    $result = changeTool('create_records', ['resource' => 'products', 'items' => [['name' => 'أ', 'price' => 1], ['name' => 'ب', 'price' => 1]]]);

    expect($result['failed'])->toBeTrue()->and(asTenant($this->tenant->id, fn () => Product::query()->count()))->toBe(0);
});

it('keeps drafts as drafts when asked, and deletes only untouched drafts on «امسح»', function () {
    $kept = changeTool('create_records', ['resource' => 'products', 'items' => [['name' => 'مسودة', 'price' => 10]], 'keep_draft' => true]);
    $this->postJson("/api/v1/dashboard/ai/copilot/change-sets/{$kept['data']['change_set_id']}/accept")->assertStatus(202);
    expect(asTenant($this->tenant->id, fn () => Product::query()->where('name', 'مسودة')->value('is_active')))->toBeFalse()
        ->and(changeSet($kept['data']['change_set_id'])->status)->toBe('applied');

    $made = changeTool('create_records', ['resource' => 'products', 'items' => [['name' => 'تمسح', 'price' => 10], ['name' => 'اتعدلت', 'price' => 10]]]);
    $this->travel(1)->minutes();
    asTenant($this->tenant->id, fn () => Product::query()->where('name', 'اتعدلت')->firstOrFail()->forceFill(['description' => 'التاجر كتب وصف'])->save());

    $this->postJson("/api/v1/dashboard/ai/copilot/change-sets/{$made['data']['change_set_id']}/reject")->assertOk()->assertJsonPath('data.status', 'rejected');

    expect(asTenant($this->tenant->id, fn () => Product::query()->pluck('name')->sort()->values()->all()))->toBe(['اتعدلت', 'مسودة']);
});

it('previews a price change without touching the store, then applies exactly the preview', function () {
    $a = product(['price' => '100.00']);
    $b = product(['price' => '99.99']);
    $other = product(['price' => '5000.00']);

    $proposal = priceUp(['filters' => ['price' => ['lte' => 200]]], 30, ['to' => 5, 'mode' => 'nearest']);

    expect($proposal['failed'])->toBeFalse()
        ->and($proposal['data']['records'])->toBe(2)
        ->and(fresh($a)->price)->toBe('100.00');
    $set = changeSet($proposal['data']['change_set_id']);
    $items = CopilotChangeItem::query()->withoutGlobalScopes()->where('change_set_id', $set->id)->orderBy('entity_id')->get();
    expect($items->pluck('after')->all())->toBe([['price' => '130.00'], ['price' => '130.00']])
        ->and(now()->diffInHours($set->expires_at))->toBeGreaterThan(23);

    $card = $this->getJson("/api/v1/dashboard/ai/copilot/change-sets/{$set->id}")->assertOk()->json('data');
    expect($card)->toMatchArray(['kind' => 'update', 'status' => 'proposed', 'can' => ['accept' => true, 'reject' => true, 'revert' => false]])
        ->and($card['columns'][0])->toMatchArray(['key' => 'price', 'label' => 'السعر', 'kind' => 'money'])
        ->and($card['items'][0]['url'])->toStartWith('/dashboard/catalog/products/');

    $this->postJson("/api/v1/dashboard/ai/copilot/change-sets/{$set->id}/accept")->assertStatus(202);

    expect([fresh($a)->price, fresh($b)->price, fresh($other)->price])->toBe(['130.00', '130.00', '5000.00'])
        ->and(changeSet($set->id)->status)->toBe('applied');
    $this->postJson("/api/v1/dashboard/ai/copilot/change-sets/{$set->id}/accept")->assertStatus(409)->assertJsonPath('code', 'change_decided');
});

it('skips a product edited by hand after the preview, but not one whose stock moved', function () {
    $edited = product(['price' => '100.00']);
    $sold = product(['price' => '100.00', 'stock_mode' => 'product', 'stock' => 10]);
    $proposal = priceUp(['ids' => [$edited->id, $sold->id]], 10);

    asTenant($this->tenant->id, function () use ($edited, $sold) {
        Product::query()->whereKey($edited->id)->update(['price' => '150.00']);
        Product::query()->whereKey($sold->id)->update(['stock' => 9]);
    });
    $this->postJson("/api/v1/dashboard/ai/copilot/change-sets/{$proposal['data']['change_set_id']}/accept")->assertStatus(202);

    expect(fresh($edited)->price)->toBe('150.00')
        ->and(fresh($sold)->price)->toBe('110.00')
        ->and(changeSet($proposal['data']['change_set_id'])->skipped_count)->toBe(1);
    $stale = $this->getJson("/api/v1/dashboard/ai/copilot/change-sets/{$proposal['data']['change_set_id']}/items?status=skipped_stale")->assertOk()->json('data.items');
    expect($stale)->toHaveCount(1)->and($stale[0]['note'])->toContain('يدوي');
});

it('skips what would break a rule, with the reason', function () {
    $fine = product(['price' => '100.00', 'compare_at_price' => '200.00']);
    $broken = product(['price' => '100.00', 'compare_at_price' => '120.00']);
    $variant = product(['stock_mode' => 'variant']);

    $proposal = priceUp(['ids' => [$fine->id, $broken->id]], 50);
    $stock = changeTool('update_records', ['resource' => 'products', 'selector' => ['ids' => [$variant->id]], 'changes' => ['stock' => ['set' => 5]]]);

    expect($proposal['data']['records'])->toBe(1)
        ->and($proposal['data']['skipped_invalid'])->toBe(1)
        ->and($proposal['data']['skip_reasons'][0])->toContain('السعر قبل الخصم')
        ->and($stock['failed'])->toBeTrue()->and($stock['data']['error'])->toContain('لكل اختيار');
});

it('changes stock and categories through the product\'s own request and action', function () {
    $product = product(['stock_mode' => 'product', 'stock' => 3]);
    $category = asTenant($this->tenant->id, fn () => Category::query()->create(['name' => 'أحذية', 'slug' => 'shoes', 'depth' => 0, 'position' => 0, 'is_visible' => true]));

    $proposal = changeTool('update_records', ['resource' => 'products', 'selector' => ['ids' => [$product->id]], 'changes' => ['stock' => ['add' => 7], 'category_ids' => ['add' => [$category->id]]]]);
    $card = $this->getJson("/api/v1/dashboard/ai/copilot/change-sets/{$proposal['data']['change_set_id']}")->json('data');
    expect($card['items'][0]['after']['category_ids'])->toBe('أحذية');

    $this->postJson("/api/v1/dashboard/ai/copilot/change-sets/{$proposal['data']['change_set_id']}/accept")->assertStatus(202);

    $after = asTenant($this->tenant->id, fn () => Product::query()->with('categories')->findOrFail($product->id));
    expect($after->stock)->toBe(10)
        ->and($after->categories->pluck('id')->all())->toBe([$category->id])
        ->and(asTenant($this->tenant->id, fn () => StockMovement::query()->where('product_id', $product->id)->value('change')))->toBe(7);
});

it('applies a big price change in a few grouped queries', function () {
    asTenant($this->tenant->id, fn () => Product::factory()->count(300)->create(['price' => '100.00']));
    $proposal = priceUp(['filters' => []], 30);

    DB::enableQueryLog();
    $this->postJson("/api/v1/dashboard/ai/copilot/change-sets/{$proposal['data']['change_set_id']}/accept")->assertStatus(202);
    $updates = collect(DB::getQueryLog())->filter(fn ($q) => str_starts_with(strtolower($q['query']), 'update `products`'))->count();
    DB::disableQueryLog();

    expect($updates)->toBe(1)
        ->and(asTenant($this->tenant->id, fn () => Product::query()->where('price', '130.00')->count()))->toBe(300);
});

it('lets the merchant revert within 24 hours, without overwriting later edits', function () {
    $a = product(['price' => '100.00']);
    $b = product(['price' => '100.00']);
    $proposal = priceUp(['ids' => [$a->id, $b->id]], 20);
    $id = $proposal['data']['change_set_id'];
    $this->postJson("/api/v1/dashboard/ai/copilot/change-sets/{$id}/accept")->assertStatus(202);
    asTenant($this->tenant->id, fn () => Product::query()->whereKey($b->id)->update(['price' => '199.00']));

    $revert = $this->postJson("/api/v1/dashboard/ai/copilot/change-sets/{$id}/revert")->assertStatus(202)->json('data');

    expect([fresh($a)->price, fresh($b)->price])->toBe(['100.00', '199.00'])
        ->and(changeSet($id)->status)->toBe('reverted')
        ->and(changeSet($revert['id'])->status)->toBe('applied');
    $this->postJson("/api/v1/dashboard/ai/copilot/change-sets/{$id}/revert")->assertStatus(422)->assertJsonPath('code', 'change_not_reversible');

    $late = priceUp(['ids' => [$a->id]], 10)['data']['change_set_id'];
    $this->postJson("/api/v1/dashboard/ai/copilot/change-sets/{$late}/accept")->assertStatus(202);
    $this->travel(CopilotChangeSet::REVERT_HOURS + 1)->hours();
    $this->postJson("/api/v1/dashboard/ai/copilot/change-sets/{$late}/revert")->assertStatus(422);
});

it('expires a proposal after 24 hours', function () {
    $product = product(['price' => '100.00']);
    $id = priceUp(['ids' => [$product->id]], 10)['data']['change_set_id'];
    $other = priceUp(['ids' => [$product->id]], 20)['data']['change_set_id'];

    $this->travel(CopilotChangeSet::PROPOSAL_HOURS + 1)->hours();
    $this->postJson("/api/v1/dashboard/ai/copilot/change-sets/{$id}/accept")->assertStatus(422)->assertJsonPath('code', 'change_expired');
    $this->artisan('copilot:expire')->assertSuccessful();

    expect(changeSet($other)->status)->toBe('expired')->and(fresh($product)->price)->toBe('100.00');
});

it('changes the record the merchant has open, and refuses more open proposals than allowed', function () {
    $open = product(['price' => '300.00']);
    product(['price' => '300.00']);

    $proposal = changeTool('update_records', ['resource' => 'products', 'selector' => ['context' => 'entity'], 'changes' => ['price' => ['add' => -50]]], ['entity' => ['type' => 'products', 'id' => $open->id]]);
    expect($proposal['data']['records'])->toBe(1)
        ->and(changeTool('update_records', ['resource' => 'products', 'selector' => ['context' => 'selection'], 'changes' => ['price' => ['add' => 1]]])['data']['error'])->toContain('no products open or selected');

    for ($i = 1; $i < CopilotChangeSet::MAX_OPEN; $i++) {
        priceUp(['ids' => [$open->id]], $i);
    }
    expect(priceUp(['ids' => [$open->id]], 99)['data']['error'])->toContain('مستنية');
});

it('keeps changes to their store and gives the model no way to decide', function () {
    $product = product(['price' => '100.00']);
    $id = priceUp(['ids' => [$product->id]], 10)['data']['change_set_id'];

    $names = Tenancy::runAs($this->tenant->id, fn () => app(CopilotTools::class)->names(new CopilotContext($this->tenant, $this->user)));
    expect(array_intersect($names, ['accept', 'publish', 'reject', 'revert', 'apply']))->toBe([]);

    Sanctum::actingAs(createOwner());
    foreach (['get' => '', 'post' => '/accept'] as $method => $path) {
        $this->json($method, "/api/v1/dashboard/ai/copilot/change-sets/{$id}{$path}")->assertNotFound();
    }
    expect(fresh($product)->price)->toBe('100.00');
});

it('lists the history and gives the whole preview as Excel', function () {
    $product = product(['price' => '100.00']);
    priceUp(['ids' => [$product->id]], 10);

    $this->getJson('/api/v1/dashboard/ai/copilot/change-sets')->assertOk()->assertJsonPath('meta.total', 1)->assertJsonPath('data.0.target_label', 'المنتجات');
    $this->getJson('/api/v1/dashboard/ai/copilot/change-sets?status=nope')->assertStatus(422);
    $id = CopilotChangeSet::query()->withoutGlobalScopes()->value('id');
    $this->get("/api/v1/dashboard/ai/copilot/change-sets/{$id}/items/file")->assertOk()->assertHeader('content-disposition');
});
