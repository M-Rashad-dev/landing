<?php

declare(strict_types=1);

use App\Ai\Copilot\CopilotContext;
use App\Ai\Copilot\CopilotTools;
use App\Billing\PlanCatalog;
use App\Billing\PlatformSettings;
use App\Imports\Products\ColumnMapper;
use App\Imports\Spreadsheet\XlsxReader;
use App\Imports\Spreadsheet\XlsxWriter;
use App\Jobs\ImportProductImages;
use App\Models\CopilotExport;
use App\Models\PlanFeatureValue;
use App\Models\Product;
use App\Models\User;
use App\Tenancy\Tenancy;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;

/*
 * «المواصفات» in sheets (docs/plans/tekno/PLAN.md §1.5): «{group}: {label}» columns fill the product's tables on
 * import (made from the store's group, or as the product's own table), and the products export writes them back.
 */

function sieXlsx(array $headers, array $rows): UploadedFile
{
    $path = tempnam(sys_get_temp_dir(), 'sie').'.xlsx';
    app(XlsxWriter::class)->write($path, 'Sheet', $headers, $rows);

    return new UploadedFile($path, 'products.xlsx', null, null, true);
}

/** @return array{0: array<string, mixed>, 1: array<string, mixed>} the upload preview and the finished import */
function sieImport(UploadedFile $file): array
{
    $preview = test()->postJson('/api/v1/dashboard/product-imports', ['file' => $file])->assertCreated()->json('data');
    test()->postJson("/api/v1/dashboard/product-imports/{$preview['id']}/start", [
        'mapping' => $preview['mapping'],
        'options' => ['match' => 'sku', 'existing' => 'update', 'visible' => true],
    ])->assertOk();

    return [$preview, test()->getJson("/api/v1/dashboard/product-imports/{$preview['id']}")->assertOk()->json('data')];
}

/** @return list<array<string, mixed>> */
function sieSpecs(string $sku): array
{
    $id = asTenant(test()->user, fn () => Product::query()->where('sku', $sku)->value('id'));

    return test()->getJson("/api/v1/dashboard/products/{$id}")->assertOk()->json('data.specs');
}

beforeEach(function () {
    Storage::fake('local');
    Queue::fake([ImportProductImages::class]);
    $this->user = actingAsOwner();
});

it('maps «group: label» columns to the specs on our own and hand-made sheets only', function () {
    $mapper = new ColumnMapper;
    $headers = ['اسم المنتج', 'السعر', 'لابتوب: المعالج', 'لابتوب: وصف مختصر', 'الضمان : المدة'];
    expect($mapper->guess($headers, 'generic'))->toMatchArray(['name' => 0, 'price' => 1, 'specs' => [2, 3, 4]]);
    // WooCommerce «Meta: …» columns are not specs.
    expect($mapper->guess(['Name', 'Regular price', 'Meta: _color'], 'woocommerce'))->not->toHaveKey('specs');
});

it('fills spec tables from an import, from the store groups or as the product own tables', function () {
    $this->postJson('/api/v1/dashboard/spec-groups', ['name' => 'لابتوب', 'rows' => [
        ['label' => 'المعالج', 'in_card' => true, 'filterable' => true], ['label' => 'الرامات', 'in_card' => true], ['label' => 'التخزين'],
    ]])->assertCreated();

    [$preview, $done] = sieImport(sieXlsx(
        ['اسم المنتج', 'السعر', 'SKU', 'لابتوب: الرامات', 'لابتوب: الوزن', 'في العلبة: شاحن'],
        [
            ['لابتوب 14', '24999', 'LP-14', '16GB', '1.4 كجم', '65W'],
            ['ماوس', '450', 'MS-1', '', '', ''],
        ],
    ));
    expect($preview['mapping']['specs'])->toBe([3, 4, 5])->and($done['created'])->toBe(2);

    $specs = sieSpecs('LP-14');
    expect(array_column($specs, 'name'))->toBe(['لابتوب', 'في العلبة'])
        // The whole group came (its flags too), the value went in its row, an unknown label was added at the end.
        ->and(array_column($specs[0]['rows'], 'label'))->toBe(['المعالج', 'الرامات', 'التخزين', 'الوزن'])
        ->and(array_column($specs[0]['rows'], 'value'))->toBe([null, '16GB', null, '1.4 كجم'])
        ->and(array_column($specs[0]['rows'], 'in_card'))->toBe([true, true, false, false])
        ->and($specs[0]['spec_group_id'])->not->toBeNull()
        ->and($specs[1]['spec_group_id'])->toBeNull()
        ->and($specs[1]['rows'])->toBe([['label' => 'شاحن', 'value' => '65W', 'in_card' => false, 'filterable' => false]]);
    // Empty cells make no tables.
    expect(sieSpecs('MS-1'))->toBe([]);

    // Updating by SKU: filled cells change their rows, empty ones keep the old values.
    sieImport(sieXlsx(['SKU', 'لابتوب: المعالج', 'لابتوب: الرامات'], [['LP-14', 'Core i5', '']]));
    $rows = sieSpecs('LP-14')[0]['rows'];
    expect(array_column($rows, 'value'))->toBe(['Core i5', '16GB', null, '1.4 كجم']);
});

it('keeps the spec limits on import and says so', function () {
    config(['landing.limits.spec_tables' => 1]);

    [, $done] = sieImport(sieXlsx(['اسم المنتج', 'السعر', 'SKU', 'أ: س', 'ب: ص'], [['منتج', '100', 'P-1', '1', '2']]));

    expect(array_column(sieSpecs('P-1'), 'name'))->toBe(['أ'])
        ->and(implode(' ', $done['warnings']))->toContain('أقصى عدد جداول');
});

it('exports the products with their spec columns, and the file imports back', function () {
    app(PlatformSettings::class)->save(['ai_features' => ['support' => false, 'designer' => false, 'copilot' => true], 'ai_usd_rate' => 50, 'ai_margin_percent' => 10, 'ai_welcome_credit' => 0]);
    PlanFeatureValue::query()->updateOrCreate(['plan_key' => 'pro', 'entitlement' => 'ai'], ['value' => 1]);
    PlanCatalog::flush();
    $this->postJson('/api/v1/dashboard/products', ['name' => 'لابتوب 14', 'price' => 24999, 'sku' => 'LP-14', 'specs' => [
        ['name' => 'لابتوب', 'rows' => [['label' => 'المعالج', 'value' => 'Core i5'], ['label' => 'الرامات', 'value' => '16GB']]],
    ]])->assertCreated();
    $this->postJson('/api/v1/dashboard/products', ['name' => 'سماعة', 'price' => 1499, 'sku' => 'HP-1', 'specs' => [
        ['name' => 'سماعة', 'rows' => [['label' => 'البطارية', 'value' => '30 ساعة']]],
    ]])->assertCreated();

    /** @var User $user */
    $user = $this->user;
    $ctx = new CopilotContext($user->tenant, $user);
    Tenancy::runAs($user->tenant_id, fn () => app(CopilotTools::class)->run('export_xlsx', ['resource' => 'products'], $ctx));
    $export = CopilotExport::query()->withoutGlobalScopes()->sole();
    $rows = iterator_to_array(app(XlsxReader::class)->rows(Storage::disk('local')->path($export->path)), false);

    $headers = $rows[0];
    expect($headers)->toContain('لابتوب: المعالج')->toContain('لابتوب: الرامات')->toContain('سماعة: البطارية');
    $byName = collect(array_slice($rows, 1))->keyBy(fn (array $r) => $r[array_search('الاسم', $headers, true)]);
    expect($byName['لابتوب 14'][array_search('لابتوب: الرامات', $headers, true)])->toBe('16GB')
        ->and($byName['سماعة'][array_search('سماعة: البطارية', $headers, true)])->toBe('30 ساعة');

    // The merchant edits a value in the file and imports it back (matched by SKU).
    $col = array_search('لابتوب: الرامات', $headers, true);
    $data = array_map(fn (array $r) => array_pad($r, count($headers), ''), array_slice($rows, 1));
    foreach ($data as $i => $r) {
        if ($r[array_search('الاسم', $headers, true)] === 'لابتوب 14') {
            $data[$i][$col] = '32GB';
        }
    }
    sieImport(sieXlsx($headers, $data));
    expect(array_column(sieSpecs('LP-14')[0]['rows'], 'value'))->toBe(['Core i5', '32GB']);
});

it('has spec columns in the ready template', function () {
    $file = $this->get('/api/v1/dashboard/product-imports/template')->assertOk()->baseResponse->getFile()->getPathname();
    $headers = iterator_to_array(app(XlsxReader::class)->rows($file), false)[0];
    expect($headers)->toContain('المواصفات: الخامة');
});
