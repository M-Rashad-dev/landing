<?php

declare(strict_types=1);

use App\Actions\Media\UploadMedia;
use App\Imports\Products\CellParser;
use App\Imports\Products\ColumnMapper;
use App\Imports\Products\ImageFetcher;
use App\Imports\Spreadsheet\CsvReader;
use App\Imports\Spreadsheet\SpreadsheetReader;
use App\Imports\Spreadsheet\XlsxReader;
use App\Imports\Spreadsheet\XlsxWriter;
use App\Jobs\ImportProductImages;
use App\Models\Category;
use App\Models\Domain;
use App\Models\EntitlementOverride;
use App\Models\Product;
use App\Models\ProductImport;
use App\Models\Tenant;
use App\Models\User;
use App\Services\Dns\DnsResolver;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;

/** A CSV upload from lines of cells (UTF-8 with BOM, like Excel's "CSV UTF-8"). */
function importCsv(array $rows, string $name = 'products.csv', string $prefix = "\xEF\xBB\xBF"): UploadedFile
{
    $handle = fopen('php://temp', 'w+');
    foreach ($rows as $row) {
        fputcsv($handle, $row, ',', '"', '');
    }
    rewind($handle);

    return UploadedFile::fake()->createWithContent($name, $prefix.stream_get_contents($handle));
}

function importXlsx(array $headers, array $rows): UploadedFile
{
    $path = tempnam(sys_get_temp_dir(), 't').'.xlsx';
    app(XlsxWriter::class)->write($path, 'Sheet', $headers, $rows);

    return new UploadedFile($path, 'products.xlsx', null, null, true);
}

/** Upload, then start with the guessed mapping (or the one given). @return array<string, mixed> the finished import */
function runImport(UploadedFile $file, array $options = [], ?array $mapping = null): array
{
    $preview = test()->postJson('/api/v1/dashboard/product-imports', ['file' => $file])->assertCreated()->json('data');
    test()->postJson("/api/v1/dashboard/product-imports/{$preview['id']}/start", [
        'mapping' => $mapping ?? $preview['mapping'],
        'options' => [...['match' => 'sku', 'existing' => 'update', 'visible' => true], ...$options],
    ])->assertOk();

    return test()->getJson("/api/v1/dashboard/product-imports/{$preview['id']}")->assertOk()->json('data');
}

beforeEach(function () {
    Storage::fake('local');
    Queue::fake([ImportProductImages::class]);
});

// --- reading files ------------------------------------------------------------------------

it('reads xlsx it wrote, keeping empty cells in place and long numbers as digits', function () {
    $path = tempnam(sys_get_temp_dir(), 'x').'.xlsx';
    app(XlsxWriter::class)->write($path, 'S', ['أ', 'ب', 'ج'], [['1', '', 'ثالث'], ['00123', '<b>&', '']]);

    expect(iterator_to_array(app(XlsxReader::class)->rows($path), false))->toBe([['أ', 'ب', 'ج'], ['1', '', 'ثالث'], ['00123', '<b>&']]);
});

it('reads CSV from Excel in Arabic Windows-1256, with ; separators', function () {
    $path = tempnam(sys_get_temp_dir(), 'c');
    file_put_contents($path, iconv('UTF-8', 'CP1256', 'الاسم;السعر
قميص;150
'));

    expect(iterator_to_array(app(CsvReader::class)->rows($path), false))->toBe([['الاسم', 'السعر'], ['قميص', '150']]);
});

it('finds the header row under a title row and skips empty rows', function () {
    $path = tempnam(sys_get_temp_dir(), 'c');
    file_put_contents($path, "قائمة المنتجات\nName,Price\n\nA,10\n");
    $sheet = app(SpreadsheetReader::class)->open($path, 'csv');

    expect($sheet['headers'])->toBe(['Name', 'Price'])
        ->and($sheet['header_line'])->toBe(2)
        ->and(iterator_to_array($sheet['rows']))->toBe([4 => ['A', '10']]);
});

// --- understanding columns and cells ------------------------------------------------------

it('recognises exports from other platforms and maps their columns', function () {
    $mapper = app(ColumnMapper::class);

    $old = ['Handle', 'Title', 'Body (HTML)', 'Option1 Name', 'Option1 Value', 'Variant SKU', 'Variant Inventory Qty', 'Variant Price', 'Variant Compare At Price', 'Image Src', 'Status'];
    expect($mapper->detectSource($old))->toBe('shopify')
        ->and($mapper->guess($old, 'shopify'))->toMatchArray(['group' => 0, 'name' => 1, 'description' => 2, 'option1_name' => 3, 'option1_value' => 4, 'sku' => 5, 'stock' => 6, 'price' => 7, 'compare_at_price' => 8, 'images' => [9], 'status' => 10]);

    $new = ['Title', 'URL handle', 'Description', 'SKU', 'Price', 'Compare-at price', 'Inventory quantity', 'Product image URL', 'Type'];
    expect($mapper->detectSource($new))->toBe('shopify')
        ->and($mapper->guess($new, 'shopify'))->toMatchArray(['name' => 0, 'group' => 1, 'sku' => 3, 'price' => 4, 'compare_at_price' => 5, 'stock' => 6, 'images' => [7], 'category' => 8]);

    $woo = ['ID', 'Type', 'SKU', 'Name', 'Short description', 'Description', 'Sale price', 'Regular price', 'Categories', 'Images', 'Parent', 'Attribute 1 name', 'Attribute 1 value(s)', 'Stock'];
    $wooMap = $mapper->guess($woo, 'woocommerce');
    expect($mapper->detectSource($woo))->toBe('woocommerce')
        ->and($wooMap)->toMatchArray(['external_id' => 0, 'sku' => 2, 'name' => 3, 'short_description' => 4, 'description' => 5, 'sale_price' => 6, 'price' => 7, 'category' => 8, 'parent' => 10, 'option1_name' => 11, 'option1_value' => 12, 'stock' => 13])
        ->and($wooMap)->not->toHaveKey('status');

    $arabic = ['اسم المنتج', 'سعر المنتج', 'السعر قبل الخصم', 'الكمية المتوفرة', 'التصنيف', 'صور المنتج', 'وصف المنتج'];
    expect($mapper->guess($arabic))->toMatchArray(['name' => 0, 'price' => 1, 'compare_at_price' => 2, 'stock' => 3, 'category' => 4, 'images' => [5], 'description' => 6]);
});

it('reads prices, quantities and states however they are written', function () {
    expect(CellParser::money('1,250.50 ج.م'))->toBe('1250.50')
        ->and(CellParser::money('EGP ١٥٠'))->toBe('150.00')
        ->and(CellParser::money('1.250,5'))->toBe('1250.50')
        ->and(CellParser::money('99,9'))->toBe('99.90')
        ->and(CellParser::money(''))->toBeNull()
        ->and(CellParser::money('مجاني'))->toBeFalse()
        ->and(CellParser::quantity('١٢'))->toBe(12)
        ->and(CellParser::quantity('-3'))->toBe(0)
        ->and(CellParser::quantity('كتير'))->toBeFalse()
        ->and(CellParser::visible('draft'))->toBeFalse()
        ->and(CellParser::visible('منشور'))->toBeTrue()
        ->and(CellParser::urls('https://a.test/1.jpg, https://a.test/2.jpg | not-a-link'))->toBe(['https://a.test/1.jpg', 'https://a.test/2.jpg'])
        ->and(CellParser::categories('ملابس > رجالي, أحذية'))->toBe([['ملابس', 'رجالي'], ['أحذية']])
        ->and(CellParser::text('<p>سطر</p><ul><li>أول</li><li>تاني</li></ul>'))->toBe("سطر\n\n- أول\n- تاني");
});

// --- the whole flow -----------------------------------------------------------------------

it('previews an upload with our mapping guess and how much room the plan has', function () {
    actingAsOwner();

    $this->postJson('/api/v1/dashboard/product-imports', ['file' => importCsv([['اسم المنتج', 'السعر', 'SKU'], ['قميص', '150', 'A1'], ['بنطلون', '300', 'A2']])])
        ->assertCreated()
        ->assertJsonPath('data.status', 'uploaded')
        ->assertJsonPath('data.total_rows', 2)
        ->assertJsonPath('data.headers', ['اسم المنتج', 'السعر', 'SKU'])
        ->assertJsonPath('data.samples.0', ['قميص', '150', 'A1'])
        ->assertJsonPath('data.mapping.name', 0)
        ->assertJsonPath('data.mapping.price', 1)
        ->assertJsonPath('data.mapping.sku', 2);
});

it('imports simple products, keeps going past bad rows and says why each failed', function () {
    $owner = actingAsOwner();

    $import = runImport(importXlsx(['اسم المنتج', 'السعر', 'السعر قبل الخصم', 'SKU', 'الكمية', 'التصنيف', 'الحالة'], [
        ['قميص قطن', '150', '200', 'SH-1', '10', 'ملابس > رجالي', 'ظاهر'],
        ['', '99', '', 'X-1', '', '', ''],
        ['ساعة', 'مجاني', '', 'W-1', '', '', ''],
        ['جزمة', '500', '', 'SH-1', '', '', ''],
        ['مج', '80', '', 'M-1', '', 'مطبخ', 'مخفي'],
    ]));

    expect($import)->toMatchArray(['status' => 'completed', 'total_products' => 5, 'processed' => 5, 'created' => 2, 'failed' => 3]);
    asTenant($owner, function () {
        $shirt = Product::query()->where('sku', 'SH-1')->firstOrFail();
        expect($shirt->name)->toBe('قميص قطن')
            ->and((string) $shirt->price)->toBe('150.00')
            ->and((string) $shirt->compare_at_price)->toBe('200.00')
            ->and($shirt->stock_mode)->toBe('product')
            ->and($shirt->stock)->toBe(10)
            ->and($shirt->categories()->pluck('name')->all())->toBe(['رجالي'])
            ->and(Category::query()->where('name', 'ملابس')->exists())->toBeTrue()
            ->and(Product::query()->where('sku', 'M-1')->value('is_active'))->toBeFalse();
    });

    $failures = $this->getJson("/api/v1/dashboard/product-imports/{$import['id']}/failures")->assertOk()->json('data');
    expect(array_column($failures, 'row_number'))->toBe([3, 4, 5])
        ->and($failures[0]['reasons'])->toBe([__('imports.name_missing')])
        ->and($failures[1]['reasons'])->toBe([__('imports.price_invalid', ['value' => 'مجاني'])])
        ->and($failures[2]['identifier'])->toBe('SH-1')
        ->and($failures[2]['reasons'][0])->toContain('متكرر');

    $file = $this->get("/api/v1/dashboard/product-imports/{$import['id']}/failures/file")->assertOk();
    expect($file->headers->get('content-disposition'))->toContain('.xlsx');
    $rows = iterator_to_array(app(XlsxReader::class)->rows($file->getFile()->getPathname()), false);
    expect($rows[0])->toContain('سبب الفشل')
        ->and($rows[1][0])->toBe('')
        ->and(end($rows[1]))->toBe(__('imports.name_missing'));
});

it('groups a Shopify export into products with options, variant stock and images', function () {
    $owner = actingAsOwner();

    $import = runImport(importCsv([
        ['Handle', 'Title', 'Body (HTML)', 'Option1 Name', 'Option1 Value', 'Variant SKU', 'Variant Inventory Qty', 'Variant Price', 'Variant Compare At Price', 'Image Src', 'Status'],
        ['hoodie', 'Hoodie', '<p>Warm <b>hoodie</b></p>', 'Size', 'S', 'HD-S', '5', '450', '550', 'https://cdn.test/h1.jpg', 'active'],
        ['hoodie', '', '', '', 'M', 'HD-M', '0', '450', '', 'https://cdn.test/h2.jpg', ''],
        ['hoodie', '', '', '', 'L', 'HD-L', '7', '480', '', '', ''],
        ['mug', 'Mug', '', 'Title', 'Default Title', 'MUG', '3', '120', '', '', 'draft'],
    ]));

    expect($import)->toMatchArray(['created' => 2, 'failed' => 0, 'images' => ['total' => 2, 'done' => 0, 'failed' => 0]]);
    [$hoodie, $mug] = asTenant($owner, fn () => [Product::query()->with(['options.values', 'variants'])->where('name', 'Hoodie')->firstOrFail(), Product::query()->with('options')->where('name', 'Mug')->firstOrFail()]);
    expect($hoodie->description)->toBe('Warm hoodie')
        ->and((string) $hoodie->price)->toBe('450.00')
        ->and((string) $hoodie->compare_at_price)->toBe('550.00')
        ->and($hoodie->stock_mode)->toBe('variant')
        ->and($hoodie->options->first()->values->pluck('label')->all())->toBe(['S', 'M', 'L'])
        ->and($hoodie->options->first()->values->pluck('price_delta')->map(fn ($v) => (string) $v)->all())->toBe(['0.00', '0.00', '30.00'])
        ->and($hoodie->variants->sortBy('id')->pluck('stock')->all())->toBe([5, 0, 7]);
    expect($mug->options)->toHaveCount(0)->and($mug->is_active)->toBeFalse()->and($mug->stock)->toBe(3);
    Queue::assertPushed(ImportProductImages::class, fn ($job) => $job->urls === ['https://cdn.test/h1.jpg', 'https://cdn.test/h2.jpg'] && $job->productId === $hoodie->id);
});

it('updates existing products by SKU from a stock and price sheet, or leaves them when asked', function () {
    $owner = actingAsOwner();
    $product = asTenant($owner, fn () => Product::factory()->create(['sku' => 'AB-1', 'name' => 'قديم', 'price' => '100.00', 'description' => 'وصف', 'stock_mode' => 'product', 'stock' => 1]));

    $file = fn () => importCsv([['SKU', 'الكمية', 'السعر'], ['ab-1', '25', '120'], ['NEW-1', '4', '50']]);
    $import = runImport($file());
    expect($import)->toMatchArray(['updated' => 1, 'created' => 0, 'failed' => 1]);
    asTenant($owner, fn () => $product->refresh());
    expect($product->stock)->toBe(25)->and((string) $product->price)->toBe('120.00')->and($product->name)->toBe('قديم')->and($product->description)->toBe('وصف');

    $skip = runImport(importCsv([['اسم المنتج', 'SKU', 'السعر'], ['اسم تاني', 'AB-1', '5']]), ['existing' => 'skip']);
    expect($skip)->toMatchArray(['skipped' => 1, 'updated' => 0]);
});

it('stops creating products at the plan limit, with the reason on every extra row', function () {
    $tenant = Tenant::factory()->onPlan('basic')->create();
    $user = User::factory()->for($tenant)->create();
    Domain::factory()->for($tenant)->create();
    Sanctum::actingAs($user->fresh(['tenant']));
    $rows = [['اسم المنتج', 'السعر']];
    for ($i = 1; $i <= 7; $i++) {
        $rows[] = ["منتج {$i}", '10'];
    }

    $import = runImport(importCsv($rows));
    expect($import)->toMatchArray(['created' => 5, 'failed' => 2]);
    $reasons = $this->getJson("/api/v1/dashboard/product-imports/{$import['id']}/failures")->json('data.0.reasons.0');
    expect($reasons)->toContain('5');
});

it('validates the file and the mapping', function () {
    actingAsOwner();

    $this->postJson('/api/v1/dashboard/product-imports', [])->assertStatus(422)->assertJsonValidationErrors('file');
    $this->postJson('/api/v1/dashboard/product-imports', ['file' => UploadedFile::fake()->createWithContent('old.xls', 'xx')])
        ->assertStatus(422)->assertJsonPath('errors.file.0', __('imports.xls'));
    $this->postJson('/api/v1/dashboard/product-imports', ['file' => importCsv([['اسم المنتج', 'السعر']])])
        ->assertStatus(422)->assertJsonPath('errors.file.0', __('imports.no_rows'));

    $id = $this->postJson('/api/v1/dashboard/product-imports', ['file' => importCsv([['اسم المنتج', 'السعر'], ['قميص', '10']])])->json('data.id');
    $this->postJson("/api/v1/dashboard/product-imports/{$id}/start", ['mapping' => ['price' => 1, 'images' => [1]], 'options' => ['match' => 'none', 'existing' => 'update', 'visible' => true]])
        ->assertStatus(422)->assertJsonValidationErrors(['mapping.name', 'mapping.images']);
    $this->postJson("/api/v1/dashboard/product-imports/{$id}/start", ['mapping' => ['name' => 0, 'price' => 9], 'options' => ['match' => 'none', 'existing' => 'update', 'visible' => true]])
        ->assertStatus(422)->assertJsonValidationErrors('mapping.price');
});

it('runs one import at a time, cancels, and removes history without touching products', function () {
    $owner = actingAsOwner();
    $busy = asTenant($owner, fn () => ProductImport::query()->create(['status' => 'processing', 'file_name' => 'a.csv', 'extension' => 'csv', 'file_size' => 1, 'headers' => ['a']]));

    $id = $this->postJson('/api/v1/dashboard/product-imports', ['file' => importCsv([['اسم المنتج', 'السعر'], ['قميص', '10']])])->json('data.id');
    $this->postJson("/api/v1/dashboard/product-imports/{$id}/start", ['mapping' => ['name' => 0, 'price' => 1], 'options' => ['match' => 'none', 'existing' => 'update', 'visible' => true]])
        ->assertStatus(409)->assertJsonPath('code', 'busy');
    $this->deleteJson("/api/v1/dashboard/product-imports/{$busy->id}")->assertStatus(409);

    $this->postJson("/api/v1/dashboard/product-imports/{$busy->id}/cancel")->assertOk()->assertJsonPath('data.status', 'cancelled');
    $this->deleteJson("/api/v1/dashboard/product-imports/{$id}")->assertNoContent();
    $this->getJson('/api/v1/dashboard/product-imports')->assertOk()->assertJsonCount(1, 'data');
});

it('gives the template, which maps itself and imports cleanly', function () {
    $owner = actingAsOwner();

    $response = $this->get('/api/v1/dashboard/product-imports/template')->assertOk();
    $file = new UploadedFile($response->getFile()->getPathname(), 'template.xlsx', null, null, true);
    $preview = $this->postJson('/api/v1/dashboard/product-imports', ['file' => $file])->assertCreated()->json('data');
    expect($preview['source'])->toBe('maksab')
        ->and($preview['mapping'])->toMatchArray(['group' => 0, 'name' => 1, 'price' => 2, 'compare_at_price' => 3, 'sku' => 4, 'stock' => 5, 'option1_name' => 10, 'option1_value' => 11, 'status' => 14]);

    $this->postJson("/api/v1/dashboard/product-imports/{$preview['id']}/start", ['mapping' => $preview['mapping'], 'options' => ['match' => 'sku', 'existing' => 'update', 'visible' => true]])->assertOk();
    $done = $this->getJson("/api/v1/dashboard/product-imports/{$preview['id']}")->json('data');
    expect($done)->toMatchArray(['created' => 3, 'failed' => 0]);
    expect(asTenant($owner, fn () => Product::query()->where('name', 'هودي شتوي مبطن')->firstOrFail()->variants()->count()))->toBe(3);
});

it('keeps imports to their store and needs a sign-in', function () {
    $this->getJson('/api/v1/dashboard/product-imports')->assertUnauthorized();

    $other = createOwner();
    $foreign = asTenant($other, fn () => ProductImport::query()->create(['status' => 'completed', 'file_name' => 'a.csv', 'extension' => 'csv', 'file_size' => 1, 'headers' => ['a']]));
    actingAsOwner();
    $this->getJson("/api/v1/dashboard/product-imports/{$foreign->id}")->assertNotFound();
    $this->getJson("/api/v1/dashboard/product-imports/{$foreign->id}/failures")->assertNotFound();
    $this->postJson("/api/v1/dashboard/product-imports/{$foreign->id}/cancel")->assertNotFound();
    $this->getJson('/api/v1/dashboard/product-imports')->assertOk()->assertJsonCount(0, 'data');
});

it('downloads product images from public links only and attaches them in order', function () {
    $owner = actingAsOwner();
    app()->instance(DnsResolver::class, new class implements DnsResolver
    {
        public function cnameTargets(string $host): array
        {
            return [];
        }

        public function ipv4(string $host): array
        {
            return ['cdn.test' => ['93.184.216.34'], 'inside.test' => ['10.0.0.5']][$host] ?? [];
        }
    });
    $image = imagecreatetruecolor(64, 64);
    ob_start();
    imagepng($image);
    $png = (string) ob_get_clean();
    Http::fake(['cdn.test/*' => Http::response($png, 200, ['Content-Type' => 'image/png']), '*' => Http::response('', 500)]);
    [$product, $import] = asTenant($owner, fn () => [
        Product::factory()->create(),
        ProductImport::query()->create(['status' => 'completed', 'file_name' => 'a.csv', 'extension' => 'csv', 'file_size' => 1, 'headers' => ['a'], 'images_total' => 3]),
    ]);

    (new ImportProductImages($owner->tenant_id, $import->id, $product->id, ['https://cdn.test/a.png', 'https://inside.test/b.png', 'http://127.0.0.1/c.png'], false))
        ->handle(app(ImageFetcher::class), app(UploadMedia::class));

    asTenant($owner, function () use ($product, $import) {
        expect($product->media()->count())->toBe(1)
            ->and($import->fresh()->images_done)->toBe(1)
            ->and($import->fresh()->images_failed)->toBe(2);
    });
    Http::assertSentCount(1);
});

it('imports 1,500 products in one go', function () {
    $owner = actingAsOwner();
    // Above every plan's own limit: the admin gave this store more room.
    EntitlementOverride::query()->create(['tenant_id' => $owner->tenant_id, 'entitlement' => 'products', 'value' => 5000, 'reason' => 'test']);
    $rows = [['اسم المنتج', 'السعر', 'SKU', 'الكمية', 'التصنيف']];
    for ($i = 1; $i <= 1500; $i++) {
        $rows[] = ["منتج رقم {$i}", (string) (10 + $i), "BULK-{$i}", (string) ($i % 50), 'قسم '.($i % 5)];
    }

    $started = microtime(true);
    $import = runImport(importCsv($rows));
    $seconds = microtime(true) - $started;

    expect($import)->toMatchArray(['status' => 'completed', 'created' => 1500, 'failed' => 0])
        ->and(asTenant($owner, fn () => Product::query()->count()))->toBe(1500)
        ->and(asTenant($owner, fn () => Category::query()->count()))->toBe(5);
    fwrite(STDERR, sprintf("\n1500 products imported in %.1fs\n", $seconds));
});
