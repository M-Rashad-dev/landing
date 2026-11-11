<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Dashboard;

use App\Actions\Products\BulkProducts;
use App\Actions\Products\DeleteProduct;
use App\Actions\Products\DuplicateProduct;
use App\Actions\Products\QuickUpdateProduct;
use App\Actions\Products\SaveProduct;
use App\Http\Controllers\Controller;
use App\Http\Requests\Dashboard\BulkProductRequest;
use App\Http\Requests\Dashboard\ProductRequest;
use App\Http\Requests\Dashboard\QuickProductRequest;
use App\Http\Resources\ProductResource;
use App\Jobs\RevalidateTenantHosts;
use App\Models\Product;
use App\Rules\TenantExists;
use App\Store\ProductList;
use App\Store\SeoDefaults;
use App\Tenancy\Tenancy;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

final class ProductController extends Controller
{
    private const DETAIL = ['options.values', 'media', 'categories', 'variants'];

    /** What a product card needs. */
    private const CARD = ['media', 'categories:id,name'];

    public function index(Request $request, ProductList $list): JsonResponse
    {
        $filters = $request->validate([
            'q' => ['nullable', 'string', 'max:100'],
            'category_id' => ['nullable', 'integer', TenantExists::table('categories')],
            'status' => ['nullable', 'string', 'in:'.implode(',', ProductList::STATUSES)],
            'sort' => ['nullable', 'string', 'in:'.implode(',', ProductList::SORTS)],
            // Older screens: ?active=1|0.
            'active' => ['nullable', 'in:0,1'],
        ]);
        $filters['category_id'] = isset($filters['category_id']) ? (int) $filters['category_id'] : null;
        if (! isset($filters['status']) && isset($filters['active'])) {
            $filters['status'] = $filters['active'] === '1' ? 'active' : 'inactive';
        }

        $products = $list->query($filters)
            ->with(self::CARD)
            ->withCount('options')
            ->withSum('variants', 'stock')
            ->paginate($this->perPage($request));

        return $this->paginated($products, ProductResource::class, ['counts' => $list->counts($filters)]);
    }

    public function store(ProductRequest $request, SaveProduct $action): JsonResponse
    {
        return $this->created($this->detail($action->handle($request->validated()), $request));
    }

    public function show(Request $request, Product $product): JsonResponse
    {
        return $this->ok($this->detail($product, $request));
    }

    public function update(ProductRequest $request, Product $product, SaveProduct $action): JsonResponse
    {
        return $this->ok($this->detail($action->handle($request->validated(), $product), $request));
    }

    /** Edit from the product card (name, price, categories, stock). Returns the card. */
    public function quick(QuickProductRequest $request, Product $product, QuickUpdateProduct $action): JsonResponse
    {
        $product = $action->handle($product, $request->validated());

        return $this->ok(ProductResource::make($product->load(self::CARD)->loadCount('options')->loadSum('variants', 'stock'))->resolve($request));
    }

    public function bulk(BulkProductRequest $request, BulkProducts $action): JsonResponse
    {
        $result = $action->handle(
            (string) $request->validated('action'),
            array_values(array_map('intval', (array) $request->validated('ids'))),
            $request->validated('category_id') === null ? null : (int) $request->validated('category_id'),
        );

        return $this->ok($result);
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

        return $this->ok(ProductResource::make($product->load(self::CARD)->loadCount('options')->loadSum('variants', 'stock')));
    }

    public function duplicate(Request $request, Product $product, DuplicateProduct $action): JsonResponse
    {
        return $this->created($this->detail($action->handle($product), $request));
    }

    /**
     * The product page: everything, plus the automatic SEO the store uses for empty fields.
     *
     * @return array<string, mixed>
     */
    private function detail(Product $product, Request $request): array
    {
        $product->load(self::DETAIL);
        $seo = app(SeoDefaults::class);

        return [...ProductResource::make($product)->resolve($request), 'seo_defaults' => $seo->product($product, $seo->storeName())];
    }
}
