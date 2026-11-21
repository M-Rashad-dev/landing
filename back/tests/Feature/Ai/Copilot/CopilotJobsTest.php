<?php

declare(strict_types=1);

use App\Ai\Ai;
use App\Ai\AiClient;
use App\Ai\AiError;
use App\Ai\AiWallets;
use App\Ai\Copilot\CopilotContext;
use App\Ai\Copilot\CopilotTools;
use App\Ai\Copilot\Support\SheetNote;
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
use App\Models\CopilotMessage;
use App\Models\DiscountCode;
use App\Models\Identity;
use App\Models\Media;
use App\Models\PlanFeatureValue;
use App\Models\Product;
use App\Models\ProductImport;
use App\Models\ShippingCompany;
use App\Models\Tenant;
use App\Models\User;
use App\Models\UserNotification;
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

it('says the real reason when the provider refuses the platform account: stops, charges nothing, alerts the admins, no pause', function () {
    app(AiWallets::class)->credit($this->tenant, 100000, 'topup');
    $admin = User::factory()->superAdmin()->create();
    $ids = inStore(fn () => Product::factory()->count(3)->create()->modelKeys());
    app(AiClient::class)->imageError = new AiError('OpenRouter 402 This request requires at least $1.00 in balance for image or video output', 402);

    $id = jobTool('run_action', ['action' => 'products.images', 'args' => ['selector' => ['ids' => $ids], 'mode' => 'generate']])['data']['change_set_id'];
    $this->postJson("/api/v1/dashboard/ai/copilot/change-sets/{$id}/accept")->assertStatus(202);

    $set = jobSet($id);
    $reason = __('ai.unavailable_reasons.provider');
    expect($set->status)->toBe('failed')
        ->and($set->error)->toContain($reason)->toContain(__('ai.copilot.not_charged'))->not->toContain('402')
        // The first refusal stops the run: one provider call, not three.
        ->and(AiUsage::query()->where('ok', false)->count())->toBe(1)
        ->and(jobCharges())->toBe(0)
        ->and(app(Ai::class)->pausedUntil())->toBeNull()
        ->and(UserNotification::query()->where('user_id', $admin->id)->where('event', 'ai_paused')->count())->toBe(1);
    // The chat's status line (the model reads it next turn) carries the reason, not «nothing came out».
    $note = inStore(fn () => CopilotMessage::query()->where('chat_id', $this->chat->id)->latest('id')->value('text'));
    expect($note)->toContain($reason)->not->toContain(__('ai.copilot.changes.job_empty'));
});

it('makes a product photo with the store logo on it in one run', function () {
    app(AiWallets::class)->credit($this->tenant, 100000, 'topup');
    $logo = inStore(fn () => storedImage(100, 100, [255, 0, 0]));
    inStore(fn () => Identity::factory()->default()->create(['logo_media_id' => $logo->id]));
    $product = inStore(fn () => Product::factory()->create(['name' => 'بطاطس مقليه']));

    $id = jobTool('run_action', ['action' => 'products.images', 'args' => ['selector' => ['ids' => [$product->id]], 'logo' => true]])['data']['change_set_id'];
    expect(jobSet($id)->summary)->toContain(__('ai.copilot.images_with_logo'));

    $this->postJson("/api/v1/dashboard/ai/copilot/change-sets/{$id}/accept")->assertStatus(202);
    expect(jobSet($id)->status)->toBe('proposed', (string) jobSet($id)->error);
    $this->postJson("/api/v1/dashboard/ai/copilot/change-sets/{$id}/accept")->assertStatus(202);

    $media = inStore(fn () => Product::query()->with('media')->find($product->id)->media);
    expect($media)->toHaveCount(1)->and($media->first()->mime)->toBe('image/webp');
    $drawn = imagecreatefromstring((string) Storage::disk('public')->get($media->first()->path));
    $width = imagesx($drawn);
    $green = fn (int $x, int $y) => (imagecolorat($drawn, $x, $y) >> 8) & 0xFF;
    // The red logo in the top-right corner, the generated photo (a soft colour) elsewhere.
    expect((imagecolorat($drawn, $width - 40, 40) >> 16) & 0xFF)->toBeGreaterThan(200)->and($green($width - 40, 40))->toBeLessThan(60)
        ->and($green(40, 40))->toBeGreaterThan(120);
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

/** A real image file on the fake disk (the logo job draws on the bytes). */
function storedImage(int $width, int $height, array $rgb): Media
{
    $gd = imagecreatetruecolor($width, $height);
    imagefill($gd, 0, 0, (int) imagecolorallocate($gd, ...$rgb));
    ob_start();
    imagepng($gd);
    $bytes = (string) ob_get_clean();
    $media = Media::factory()->create(['width' => $width, 'height' => $height]);
    Storage::disk('public')->put($media->path, $bytes);

    return $media;
}

it('puts the store logo on every product photo for free, previews it, and reverts it', function () {
    $logo = inStore(fn () => storedImage(100, 100, [255, 0, 0]));
    inStore(fn () => Identity::factory()->default()->create(['logo_media_id' => $logo->id]));
    [$product, $photos] = inStore(function () {
        $product = Product::factory()->create(['name' => 'شنطة']);
        $photos = [storedImage(400, 400, [255, 255, 255]), storedImage(400, 300, [255, 255, 255])];
        foreach ($photos as $i => $photo) {
            $product->media()->attach($photo->id, ['position' => $i, 'tenant_id' => test()->tenant->id]);
        }
        Product::factory()->create(['name' => 'بدون صور']);

        return [$product, $photos];
    });

    $made = jobTool('run_action', ['action' => 'products.add_logo', 'args' => []]);
    $id = $made['data']['change_set_id'];
    expect($made['data']['records'])->toBe(1)->and(jobSet($id)->summary)->toContain('2 صورة');
    expect($this->getJson("/api/v1/dashboard/ai/copilot/change-sets/{$id}")->json('data.estimate'))->toContain('مجاني');

    // No balance at all: a free job still starts.
    $this->postJson("/api/v1/dashboard/ai/copilot/change-sets/{$id}/accept")->assertStatus(202);
    $set = jobSet($id);
    expect($set->status)->toBe('proposed', (string) $set->error)->and(jobCharges())->toBe(0);

    $this->postJson("/api/v1/dashboard/ai/copilot/change-sets/{$id}/accept")->assertStatus(202);
    $now = inStore(fn () => Product::query()->with('media')->find($product->id)->media);
    expect($now)->toHaveCount(2)->and($now->pluck('id')->intersect(array_map(fn ($m) => $m->id, $photos)))->toBeEmpty();

    // The logo sits in the top-right corner (red), the rest of the photo is untouched (white).
    $drawn = imagecreatefromstring((string) Storage::disk('public')->get($now->first()->path));
    $width = imagesx($drawn);
    $red = fn (int $x, int $y) => (imagecolorat($drawn, $x, $y) >> 16) & 0xFF;
    $green = fn (int $x, int $y) => (imagecolorat($drawn, $x, $y) >> 8) & 0xFF;
    expect($red($width - 30, 30))->toBeGreaterThan(200)->and($green($width - 30, 30))->toBeLessThan(60)
        ->and($green(30, 30))->toBeGreaterThan(200);

    $this->postJson("/api/v1/dashboard/ai/copilot/change-sets/{$id}/revert")->assertStatus(202);
    expect(inStore(fn () => Product::query()->with('media')->find($product->id)->media->pluck('id')->all()))->toBe(array_map(fn ($m) => $m->id, $photos));
});

it('uses an attached logo on the first photo only, and asks for a logo when the store has none', function () {
    $product = inStore(function () {
        $product = Product::factory()->create();
        foreach ([storedImage(300, 300, [255, 255, 255]), storedImage(300, 300, [255, 255, 255])] as $i => $photo) {
            $product->media()->attach($photo->id, ['position' => $i, 'tenant_id' => test()->tenant->id]);
        }

        return $product;
    });
    $none = jobTool('run_action', ['action' => 'products.add_logo', 'args' => []]);
    expect($none['failed'])->toBeTrue()->and(json_encode($none['data'], JSON_UNESCAPED_UNICODE))->toContain('no logo');

    $logo = inStore(fn () => storedImage(80, 40, [0, 0, 255]));
    $other = Tenant::factory()->create();
    $foreign = asTenant($other->id, fn () => Media::factory()->create());
    expect(jobTool('run_action', ['action' => 'products.add_logo', 'args' => ['logo_media_id' => $foreign->id]])['failed'])->toBeTrue();

    $id = jobTool('run_action', ['action' => 'products.add_logo', 'args' => ['logo_media_id' => $logo->id, 'photos' => 'first', 'position' => 'bottom_left']])['data']['change_set_id'];
    $this->postJson("/api/v1/dashboard/ai/copilot/change-sets/{$id}/accept")->assertStatus(202);
    $this->postJson("/api/v1/dashboard/ai/copilot/change-sets/{$id}/accept")->assertStatus(202);

    $after = inStore(fn () => Product::query()->with('media')->find($product->id)->media);
    $drawn = imagecreatefromstring((string) Storage::disk('public')->get($after->first()->path));
    expect($after)->toHaveCount(2)
        ->and(imagecolorat($drawn, 20, imagesy($drawn) - 15) & 0xFF)->toBeGreaterThan(200)
        ->and((imagecolorat($drawn, 20, imagesy($drawn) - 15) >> 16) & 0xFF)->toBeLessThan(60);
});

it('creates shipping companies with their governorate fees in one go, and new drafts take a fee change at once', function () {
    $made = jobTool('create_records', ['resource' => 'shipping_companies', 'items' => [
        ['name' => 'شحن مكسب', 'default_fee' => 20, 'rates' => [['governorate' => 'الإسكندرية', 'fee' => 50, 'is_available' => true]]],
        ['name' => 'شحن سريع', 'default_fee' => 20],
    ]]);
    expect($made['failed'])->toBeFalse();
    $companies = inStore(fn () => ShippingCompany::query()->with('rates')->orderBy('id')->get());
    expect($companies)->toHaveCount(2)
        ->and($companies[0]->is_active)->toBeFalse()
        ->and($companies[0]->rates->firstWhere('governorate', 'الإسكندرية')->fee)->toBe('50.00')
        ->and($companies[1]->rates)->toBeEmpty();

    // The second step in the same reply: a draft id goes straight into the fees action.
    $fees = jobTool('run_action', ['action' => 'shipping.update_rates', 'args' => ['company_ids' => [$companies[1]->id], 'governorates' => ['الإسكندرية'], 'fee' => ['set' => 50]]]);
    expect($fees['failed'])->toBeFalse((string) json_encode($fees['data']));
});

it('makes AI logos for shipping companies without one, previews them, and reverts', function () {
    app(AiWallets::class)->credit($this->tenant, 100000, 'topup');
    [$bare, $logo] = inStore(fn () => [
        ShippingCompany::query()->create(['name' => 'شحن مكسب', 'default_fee' => '20.00', 'is_active' => true, 'position' => 0]),
        ShippingCompany::query()->create(['name' => 'بوسطة', 'default_fee' => '30.00', 'is_active' => true, 'position' => 1, 'media_id' => Media::factory()->create()->id]),
    ]);

    expect(jobTool('run_action', ['action' => 'records.image', 'args' => ['resource' => 'products', 'prompt' => 'x']])['failed'])->toBeTrue();
    $made = jobTool('run_action', ['action' => 'records.image', 'args' => ['resource' => 'shipping_companies', 'prompt' => 'A simple modern delivery truck icon, green']]);
    $id = $made['data']['change_set_id'];
    expect($made['data']['records'])->toBe(1);

    $this->postJson("/api/v1/dashboard/ai/copilot/change-sets/{$id}/accept")->assertStatus(202);
    $card = $this->getJson("/api/v1/dashboard/ai/copilot/change-sets/{$id}")->json('data');
    expect($card['status'])->toBe('proposed', (string) $card['error'])->and($card['columns'][0])->toMatchArray(['key' => 'media_id', 'kind' => 'images'])
        ->and(AiUsage::query()->where('feature', 'copilot')->where('images', 1)->count())->toBe(1);

    $this->postJson("/api/v1/dashboard/ai/copilot/change-sets/{$id}/accept")->assertStatus(202);
    $now = fn () => inStore(fn () => ShippingCompany::query()->pluck('media_id', 'id'));
    expect($now()[$bare->id])->not->toBeNull()->and($now()[$logo->id])->toBe($logo->media_id);

    $this->postJson("/api/v1/dashboard/ai/copilot/change-sets/{$id}/revert")->assertStatus(202);
    expect($now()[$bare->id])->toBeNull();
});

/** The owner's case (2026-11-21): one row already in the store, one new row with no price, one fine. */
function ownerSheet(): int
{
    $path = tempnam(sys_get_temp_dir(), 't').'.xlsx';
    app(XlsxWriter::class)->write($path, 'Sheet', ['الاسم', 'SKU', 'السعر'], [['شاورما فراخ', 'MUG-011', '120'], ['بطاطس مقليه', 'HD-S-BLK1', ''], ['وجبه زنجر', 'TS-0011', '390']]);

    return (int) test()->post('/api/v1/dashboard/ai/copilot/attachments/sheet', ['file' => new UploadedFile($path, 'منتجات.xlsx', null, null, true)], ['Accept' => 'application/json'])
        ->assertCreated()->json('data.import_id');
}

it('checks a sheet before importing: what is new, skipped and failing, with the importer\'s own reasons', function () {
    inStore(fn () => Product::factory()->create(['name' => 'شاورما فراخ', 'sku' => 'MUG-011', 'price' => '99.00']));
    $importId = ownerSheet();

    $proposal = jobTool('run_action', ['action' => 'products.import', 'args' => ['import_id' => $importId]]);
    $effects = implode("\n", $proposal['data']['side_effects']);

    expect($effects)->toContain('1 جديد')->toContain('1 هيتخطى')->toContain('1 مش هينفع')
        ->toContain('«بطاطس مقليه»')->toContain('السعر فاضي')
        ->toContain('«شاورما فراخ» (mug-011)');
});

it('fills the empty price of the sheet\'s rows in the same import, leaving the store\'s products alone', function () {
    $old = inStore(fn () => Product::factory()->create(['name' => 'شاورما فراخ', 'sku' => 'MUG-011', 'price' => '99.00']));
    inStore(fn () => Product::factory()->create(['name' => 'قديم بسعر', 'price' => '50.00']));
    $importId = ownerSheet();

    $proposal = jobTool('run_action', ['action' => 'products.import', 'args' => ['import_id' => $importId, 'fill' => ['price' => 1500]]]);
    expect(implode("\n", $proposal['data']['side_effects']))->toContain('2 جديد')->toContain('0 مش هينفع')->toContain('السعر 1500');

    $this->postJson("/api/v1/dashboard/ai/copilot/change-sets/{$proposal['data']['change_set_id']}/accept")->assertStatus(202);

    $prices = inStore(fn () => Product::query()->pluck('price', 'name'));
    expect($prices['بطاطس مقليه'])->toBe('1500.00')
        ->and($prices['وجبه زنجر'])->toBe('390.00')
        ->and($prices['شاورما فراخ'])->toBe('99.00')
        ->and($prices['قديم بسعر'])->toBe('50.00')
        ->and(inStore(fn () => ProductImport::query()->find($importId)->skipped_count))->toBe(1)
        ->and($old->fresh())->not->toBeNull();
});

it('refuses an import where nothing would come in, saying exactly why', function () {
    inStore(fn () => Product::factory()->create(['sku' => 'MUG-011']));
    inStore(fn () => Product::factory()->create(['sku' => 'TS-0011']));
    $path = tempnam(sys_get_temp_dir(), 't').'.xlsx';
    app(XlsxWriter::class)->write($path, 'Sheet', ['الاسم', 'SKU', 'السعر'], [['شاورما فراخ', 'MUG-011', '120'], ['بطاطس مقليه', 'NEW-1', '']]);
    $importId = (int) $this->post('/api/v1/dashboard/ai/copilot/attachments/sheet', ['file' => new UploadedFile($path, 'منتجات.xlsx', null, null, true)], ['Accept' => 'application/json'])->json('data.import_id');

    $refused = jobTool('run_action', ['action' => 'products.import', 'args' => ['import_id' => $importId]]);

    expect($refused['failed'])->toBeTrue()
        ->and((string) json_encode($refused['data'], JSON_UNESCAPED_UNICODE))->toContain('مفيش ولا منتج')->toContain('السعر فاضي')->toContain('هيتخطى')
        ->and(CopilotChangeSet::query()->withoutGlobalScopes()->count())->toBe(0);
});

it('keeps the sheet in the chat: the model sees it later, and after the import why rows failed', function () {
    $importId = ownerSheet();
    $notes = app(SheetNote::class);
    $import = fn () => inStore(fn () => ProductImport::query()->find($importId));

    expect(inStore(fn () => $notes->attached($import())))->toContain('«بطاطس مقليه»')->toContain('السعر فاضي')->toContain('HD-S-BLK1')
        ->and(inStore(fn () => $notes->earlier($import())))->toContain('still usable')->toContain("import_id {$importId}");

    $id = jobTool('run_action', ['action' => 'products.import', 'args' => ['import_id' => $importId]])['data']['change_set_id'];
    $this->postJson("/api/v1/dashboard/ai/copilot/change-sets/{$id}/accept")->assertStatus(202);

    expect(inStore(fn () => $notes->earlier($import())))->toContain('created 2')->toContain('failed 1')->toContain('«بطاطس مقليه»: السعر فاضي');
});
