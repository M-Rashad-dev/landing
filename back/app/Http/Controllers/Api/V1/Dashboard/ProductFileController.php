<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Dashboard;

use App\Billing\Entitlements;
use App\Exceptions\ApiException;
use App\Http\Controllers\Concerns\RespondsWithJson;
use App\Http\Controllers\Controller;
use App\Models\Product;
use App\Models\ProductFile;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/** The files a digital product delivers: each one with the name the customer sees (≤ 100 MB, in the plan's storage). */
final class ProductFileController extends Controller
{
    use RespondsWithJson;

    private const DISK = 'local';

    /** Anything but scripts and pages a browser would run. */
    private const BLOCKED = ['php', 'phtml', 'phar', 'html', 'htm', 'svg', 'js', 'mjs', 'exe', 'bat', 'cmd', 'sh', 'msi', 'com', 'scr', 'vbs', 'jar'];

    public function store(Request $request, Product $product, Entitlements $entitlements): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'file' => ['required', 'file', 'max:'.ProductFile::MAX_KB],
        ]);
        if (ProductFile::query()->where('product_id', $product->id)->count() >= ProductFile::MAX) {
            throw ValidationException::withMessages(['file' => [__('digital.files_max', ['max' => ProductFile::MAX])]]);
        }
        $file = $request->file('file');
        $ext = strtolower((string) $file->getClientOriginalExtension());
        if (in_array($ext, self::BLOCKED, true) || preg_match('/^[a-z0-9]{1,8}$/', $ext) !== 1) {
            throw ValidationException::withMessages(['file' => [__('digital.file_type')]]);
        }
        $entitlements->ensureStorageFor((int) $file->getSize());

        $path = $file->storeAs('product-files/'.$product->tenant_id.'/'.$product->id, Str::lower(Str::random(32)).'.'.$ext, self::DISK);
        $row = ProductFile::query()->create([
            'product_id' => $product->id,
            'name' => mb_substr(trim(strip_tags((string) $data['name'])), 0, 120),
            'path' => (string) $path,
            'original_name' => mb_substr(trim(strip_tags($file->getClientOriginalName())) ?: 'file.'.$ext, 0, 200),
            'mime' => (string) $file->getMimeType(),
            'size' => (int) $file->getSize(),
            'position' => (int) ProductFile::query()->where('product_id', $product->id)->max('position') + 1,
        ]);

        return $this->created($this->view($row));
    }

    public function update(Request $request, Product $product, int $file): JsonResponse
    {
        $data = $request->validate(['name' => ['required', 'string', 'max:120']]);
        $row = $this->find($product, $file);
        $row->forceFill(['name' => mb_substr(trim(strip_tags((string) $data['name'])), 0, 120)])->save();

        return $this->ok($this->view($row));
    }

    public function destroy(Product $product, int $file): Response
    {
        $row = $this->find($product, $file);
        Storage::disk(self::DISK)->delete($row->path);
        $row->delete();

        return $this->noContent();
    }

    private function find(Product $product, int $id): ProductFile
    {
        return ProductFile::query()->where('product_id', $product->id)->find($id) ?? throw new ApiException(404, 'not_found', __('landing.not_found'));
    }

    /** @return array<string, mixed> */
    private function view(ProductFile $file): array
    {
        return ['id' => $file->id, 'name' => $file->name, 'original_name' => $file->original_name, 'size' => $file->size];
    }
}
