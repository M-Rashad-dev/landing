<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Dashboard;

use App\Exceptions\ApiException;
use App\Http\Controllers\Concerns\RespondsWithJson;
use App\Http\Controllers\Controller;
use App\Jobs\RevalidateTenantHosts;
use App\Models\Product;
use App\Models\ProductCode;
use App\Store\Digital\DigitalCodes;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Validation\ValidationException;

/**
 * A codes product's entries (per option combination): add many at once, edit, delete, reorder. The merchant sees his
 * own entries; they never leave the dashboard otherwise (only to the buyer they are sent to).
 */
final class ProductCodeController extends Controller
{
    use RespondsWithJson;

    public function __construct(private readonly DigitalCodes $codes) {}

    public function index(Request $request, Product $product): JsonResponse
    {
        $key = $this->key($request, $product);

        return $this->ok($this->codes->list($product, $key));
    }

    public function store(Request $request, Product $product): JsonResponse
    {
        $data = $request->validate([
            'combination_key' => ['nullable', 'string', 'max:100'],
            'codes' => ['required', 'array', 'min:1', 'max:1000'],
            'codes.*.code' => ['required', 'string', 'max:2000'],
            'codes.*.uses' => ['nullable', 'integer', 'between:1,1000'],
        ]);
        $key = $this->key($request, $product);
        $this->codes->add($product, $key, $data['codes']);
        RevalidateTenantHosts::dispatch($product->tenant_id)->afterCommit();

        return $this->created($this->codes->list($product, $key));
    }

    public function update(Request $request, Product $product, int $code): JsonResponse
    {
        $data = $request->validate([
            'code' => ['required', 'string', 'max:2000'],
            'uses_left' => ['required', 'integer', 'between:0,1000'],
        ]);
        $row = $this->find($product, $code);
        $this->codes->edit($row, (string) $data['code'], (int) $data['uses_left']);
        RevalidateTenantHosts::dispatch($product->tenant_id)->afterCommit();

        return $this->ok($this->codes->list($product, $row->combination_key));
    }

    public function destroy(Product $product, int $code): Response
    {
        $this->find($product, $code)->delete();
        RevalidateTenantHosts::dispatch($product->tenant_id)->afterCommit();

        return $this->noContent();
    }

    /** The order they are sent in (ids of one combination, first to last). */
    public function reorder(Request $request, Product $product): JsonResponse
    {
        $data = $request->validate(['ids' => ['required', 'array', 'max:'.ProductCode::MAX], 'ids.*' => ['integer']]);
        $key = $this->key($request, $product);
        $this->codes->reorder($product, $key, array_map('intval', $data['ids']));

        return $this->ok($this->codes->list($product, $key));
    }

    private function key(Request $request, Product $product): string
    {
        if (! $product->deliversCodes()) {
            throw new ApiException(422, 'not_codes', __('digital.codes_only'));
        }
        $key = (string) ($request->input('combination_key', $request->query('combination_key', '')) ?? '');
        if (! in_array($key, array_column($this->codes->combinations($product), 'key'), true)) {
            throw ValidationException::withMessages(['combination_key' => [__('digital.combination')]]);
        }

        return $key;
    }

    private function find(Product $product, int $id): ProductCode
    {
        return ProductCode::query()->where('product_id', $product->id)->find($id) ?? throw new ApiException(404, 'not_found', __('landing.not_found'));
    }
}
