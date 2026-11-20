<?php

declare(strict_types=1);

use App\Ai\AiWallets;
use App\Ai\Copilot\CopilotContext;
use App\Ai\Copilot\CopilotTools;
use App\Billing\PlanCatalog;
use App\Billing\PlatformSettings;
use App\Enums\DiscountType;
use App\Enums\ImportStatus;
use App\Imports\Spreadsheet\XlsxWriter;
use App\Jobs\ImportProductImages;
use App\Models\AiUsage;
use App\Models\AiWalletEntry;
use App\Models\CopilotChangeSet;
use App\Models\CopilotChat;
use App\Models\DiscountCode;
use App\Models\Media;
use App\Models\PlanFeatureValue;
use App\Models\Product;
use App\Models\ProductImport;
use App\Models\ShippingCompany;
use App\Models\Tenant;
use App\Models\User;
use App\Tenancy\Tenancy;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;

beforeEach(function () {
    Storage::fake('public');
    Storage::fake('local');
    Queue::fake([ImportProductImages::class]);
    app(PlatformSettings::class)->save(['ai_features' => ['support' => false, 'designer' => false, 'copilot' => true], 'ai_usd_rate' => 50, 'ai_margin_percent' => 10, 'ai_welcome_credit' => 0]);
    PlanFeatureValue::query()->updateOrCreate(['plan_key' => 'pro', 'entitlement' => 'ai'], ['value' => 1]);
    PlanCatalog::flush();
    $this->tenant = Tenant::factory()->onPlan('pro')->create();
    $this->user = User::factory()->for($this->tenant)->create();
    Sanctum::actingAs($this->user->fresh(['tenant']));
    $this->chat = asTenant($this->tenant->id, fn () => CopilotChat::query()->create(['user_id' => $this->user->id]));
});

function jobTool(string $name, array $args): array
{
    $ctx = new CopilotContext(test()->tenant, test()->user, test()->chat);
    $result = Tenancy::runAs(test()->tenant->id, fn () => app(CopilotTools::class)->run($name, $args, $ctx));

    return ['data' => $result->data, 'failed' => $result->failed];
}

function jobSet(int $id): CopilotChangeSet
{
    return CopilotChangeSet::query()->withoutGlobalScopes()->findOrFail($id);
}

function inStore(Closure $callback): mixed
{
    return asTenant(test()->tenant->id, $callback);
}

function jobCharges(): int
{
    return AiWalletEntry::query()->withoutGlobalScopes()->where('tenant_id', test()->tenant->id)->where('type', 'charge')->where('feature', 'copilot')->count();
}

it('shows the estimated cost first, writes descriptions only on «ابدأ», then previews them for «نفّذ»', function () {
    app(AiWallets::class)->credit($this->tenant, 10000, 'topup');
    $empty = inStore(fn () => Product::factory()->count(3)->create(['description' => null]));
    $written = inStore(fn () => Product::factory()->create(['description' => 'وصف التاجر']));

    $estimate = jobTool('run_action', ['action' => 'products.write_content', 'args' => ['fields' => ['description']]]);

    $id = $estimate['data']['change_set_id'];
    expect($estimate['data']['records'])->toBe(3)
        ->and($estimate['data']['estimated_cost_egp'])->not->toBeNull()
        ->and(jobSet($id)->status)->toBe('estimate')
        ->and(jobCharges())->toBe(0);
    $card = $this->getJson("/api/v1/dashboard/ai/copilot/change-sets/{$id}")->assertOk()->json('data');
    expect($card['estimate'])->toContain('ج.م')->and($card['can']['accept'])->toBeTrue();

    $this->postJson("/api/v1/dashboard/ai/copilot/change-sets/{$id}/accept")->assertStatus(202);

    $set = jobSet($id);
    expect($set->status)->toBe('proposed', (string) $set->error)->and($set->kind)->toBe('update')->and($set->target)->toBe('products')
        ->and(jobCharges())->toBe(1)
        ->and(inStore(fn () => Product::query()->whereNull('description')->count()))->toBe(3);

    $this->postJson("/api/v1/dashboard/ai/copilot/change-sets/{$id}/accept")->assertStatus(202);

    expect(inStore(fn () => Product::query()->whereKey($empty->modelKeys())->pluck('description')->filter()->count()))->toBe(3)
        ->and(inStore(fn () => Product::query()->find($written->id)->description))->toBe('وصف التاجر');
});

it('refuses to start when the balance can\'t cover the estimate', function () {
    inStore(fn () => Product::factory()->create(['description' => null]));
    $id = jobTool('run_action', ['action' => 'products.write_content', 'args' => []])['data']['change_set_id'];

    $this->postJson("/api/v1/dashboard/ai/copilot/change-sets/{$id}/accept")->assertStatus(422)->assertJsonPath('code', 'ai_balance_low');

    expect(jobSet($id)->status)->toBe('estimate')->and(AiUsage::query()->where('feature', 'copilot')->count())->toBe(0);
});

it('generates images for products without any and improves the photo of the others', function () {
    app(AiWallets::class)->credit($this->tenant, 100000, 'topup');
    $bare = inStore(fn () => Product::factory()->create(['name' => 'كوباية']));
    $photo = inStore(function () {
        $product = Product::factory()->create(['name' => 'شنطة']);
        $product->media()->attach(Media::factory()->create()->id, ['position' => 0, 'tenant_id' => test()->tenant->id]);

        return $product;
    });

    $id = jobTool('run_action', ['action' => 'products.images', 'args' => ['selector' => ['ids' => [$bare->id, $photo->id]]]])['data']['change_set_id'];
    expect(jobSet($id)->summary)->toContain('1 صورة جديدة')->toContain('1 تحسين');

    $this->postJson("/api/v1/dashboard/ai/copilot/change-sets/{$id}/accept")->assertStatus(202);
    $card = $this->getJson("/api/v1/dashboard/ai/copilot/change-sets/{$id}")->json('data');
    // One paid image call each (the fake reports no provider cost, so the wallet entry is 0 and skipped).
    expect($card['status'])->toBe('proposed')->and($card['columns'][0])->toMatchArray(['key' => 'media_ids', 'kind' => 'images'])
        ->and(AiUsage::query()->where('feature', 'copilot')->where('images', 1)->count())->toBe(2)
        ->and($card['items'][0]['after']['media_ids'])->toBeString();

    $this->postJson("/api/v1/dashboard/ai/copilot/change-sets/{$id}/accept")->assertStatus(202);

    $old = inStore(fn () => Product::query()->with('media')->find($photo->id)->media->pluck('id')->all());
    expect(inStore(fn () => Product::query()->with('media')->find($bare->id)->media))->toHaveCount(1)
        ->and($old)->toHaveCount(1)
        ->and(inStore(fn () => Media::query()->count()))->toBe(3);
});

it('imports an attached sheet as drafts with the platform importer, only after approval', function () {
    $path = tempnam(sys_get_temp_dir(), 't').'.xlsx';
    app(XlsxWriter::class)->write($path, 'Sheet', ['اسم المنتج', 'السعر'], [['تيشيرت', '200'], ['بنطلون', '350']]);

    $sheet = $this->post('/api/v1/dashboard/ai/copilot/attachments/sheet', ['file' => new UploadedFile($path, 'منتجات.xlsx', null, null, true)], ['Accept' => 'application/json'])
        ->assertCreated()->json('data');
    expect($sheet)->toMatchArray(['file_name' => 'منتجات.xlsx', 'rows' => 2]);

    $proposal = jobTool('run_action', ['action' => 'products.import', 'args' => ['import_id' => $sheet['import_id']]]);
    $id = $proposal['data']['change_set_id'];
    expect($proposal['data']['side_effects'][0])->toContain('مسودات')
        ->and($proposal['data']['reversible'])->toBeFalse()
        ->and(inStore(fn () => ProductImport::query()->find($sheet['import_id'])->status))->toBe(ImportStatus::Uploaded);

    $this->postJson("/api/v1/dashboard/ai/copilot/change-sets/{$id}/accept")->assertStatus(202);

    expect(inStore(fn () => Product::query()->where('is_active', false)->pluck('name')->sort()->values()->all()))->toBe(['بنطلون', 'تيشيرت'])
        ->and($this->getJson("/api/v1/dashboard/ai/copilot/change-sets/{$id}")->json('data.extra'))->toBe(['import_id' => $sheet['import_id']])
        ->and($this->getJson("/api/v1/dashboard/ai/copilot/change-sets/{$id}")->json('data.can.revert'))->toBeFalse();
});

it('creates a coupon as a draft and changes it through its own request', function () {
    $made = jobTool('create_records', ['resource' => 'discount_codes', 'items' => [['code' => 'eid15', 'type' => 'percentage', 'value' => 15, 'ends_at' => '2026-12-31T23:59']]]);
    expect($made['failed'])->toBeFalse();
    $code = inStore(fn () => DiscountCode::query()->sole());
    expect($code->code)->toBe('EID15')->and($code->is_active)->toBeFalse()->and($code->type)->toBe(DiscountType::Percentage);

    $this->postJson("/api/v1/dashboard/ai/copilot/change-sets/{$made['data']['change_set_id']}/accept")->assertStatus(202);
    $change = jobTool('update_records', ['resource' => 'discount_codes', 'selector' => ['ids' => [$code->id]], 'changes' => ['value' => ['set' => 20], 'ends_at' => ['set' => '2027-01-15']]]);
    $this->postJson("/api/v1/dashboard/ai/copilot/change-sets/{$change['data']['change_set_id']}/accept")->assertStatus(202);

    $code = inStore(fn () => DiscountCode::query()->sole());
    expect($code->is_active)->toBeTrue()->and($code->value)->toBe('20.00')
        ->and($code->ends_at->setTimezone('Africa/Cairo')->format('Y-m-d H:i'))->toBe('2027-01-15 23:59');
});

it('raises the shipping fee of every governorate in one change, and reverts it', function () {
    $company = inStore(function () {
        $company = ShippingCompany::query()->create(['name' => 'بوسطة', 'default_fee' => '50.00', 'is_active' => true, 'position' => 0]);
        $company->rates()->create(['governorate' => 'القاهرة', 'fee' => '60.00', 'is_available' => true]);

        return $company;
    });

    $proposal = jobTool('run_action', ['action' => 'shipping.update_rates', 'args' => ['fee' => ['add' => 10]]]);
    $id = $proposal['data']['change_set_id'];
    $this->postJson("/api/v1/dashboard/ai/copilot/change-sets/{$id}/accept")->assertStatus(202);

    $fees = fn () => inStore(fn () => ShippingCompany::query()->with('rates')->find($company->id));
    expect($fees()->default_fee)->toBe('60.00')
        ->and($fees()->rates->firstWhere('governorate', 'القاهرة')->fee)->toBe('70.00')
        ->and($fees()->rates->firstWhere('governorate', 'الجيزة')->fee)->toBe('60.00');

    $this->postJson("/api/v1/dashboard/ai/copilot/change-sets/{$id}/revert")->assertStatus(202);

    expect($fees()->default_fee)->toBe('50.00')
        ->and($fees()->rates->firstWhere('governorate', 'القاهرة')->fee)->toBe('60.00')
        ->and($fees()->rates->firstWhere('governorate', 'الجيزة'))->toBeNull();
});

it('hides upsells from the copilot on plans without them', function () {
    PlanFeatureValue::query()->updateOrCreate(['plan_key' => 'pro', 'entitlement' => 'upsells'], ['value' => 0]);
    PlanCatalog::flush();

    expect(jobTool('find_records', ['resource' => 'upsells'])['data']['error'])->toContain('Unknown resource');
});
