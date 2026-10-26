<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Dashboard;

use App\Actions\Products\DeleteProduct;
use App\Actions\Products\DuplicateProduct;
use App\Actions\Products\SaveProduct;
use App\Http\Controllers\Controller;
use App\Http\Requests\Dashboard\ProductRequest;
use App\Http\Resources\ProductResource;
use App\Jobs\RevalidateTenantHosts;
use App\Models\Product;
use App\Tenancy\Tenancy;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

final class ProductController extends Controller
{
    private const DETAIL = ['options.values', 'media'];

    public function index(Request $request): JsonResponse
    {
        $search = trim((string) $request->query('q', ''));
        $active = $request->query('active');

        $products = Product::query()
            ->with('media')
            ->withCount('options')
            ->when($search !== '', function ($q) use ($search) {
                $like = '%'.addcslashes($search, '%_\\').'%';
                $q->where(fn ($w) => $w->where('name', 'like', $like)->orWhere('sku', 'like', $like));
            })
            ->when($active === '1' || $active === '0', fn ($q) => $q->where('is_active', $active === '1'))
            ->latest('id')
            ->paginate($this->perPage($request));

        return $this->paginated($products, ProductResource::class);
    }

    public function store(ProductRequest $request, SaveProduct $action): JsonResponse
    {
        $product = $action->handle($request->validated());

        return $this->created(ProductResource::make($product->load(self::DETAIL))->resolve($request));
    }

    public function show(Product $product): JsonResponse
    {
        return $this->ok(ProductResource::make($product->load(self::DETAIL)));
    }

    public function update(ProductRequest $request, Product $product, SaveProduct $action): JsonResponse
    {
        $product = $action->handle($request->validated(), $product);

        return $this->ok(ProductResource::make($product->load(self::DETAIL)));
    }

    public function destroy(Product $product, DeleteProduct $action): Response
    {
        $action->handle($product);

        return $this->noContent();
    }

    public function toggle(Product $product): JsonResponse
    {
        $product->update(['is_active' => ! $product->is_active]);
        RevalidateTenantHosts::dispatch((int) Tenancy::id())->afterCommit();

        return $this->ok(ProductResource::make($product->load('media')->loadCount('options')));
    }

    public function duplicate(Product $product, DuplicateProduct $action): JsonResponse
    {
        return $this->created(ProductResource::make($action->handle($product)->load(self::DETAIL))->resolve(request()));
    }
}
