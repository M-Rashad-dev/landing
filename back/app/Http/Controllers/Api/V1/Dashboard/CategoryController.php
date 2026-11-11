<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Dashboard;

use App\Http\Controllers\Concerns\RespondsWithJson;
use App\Http\Controllers\Controller;
use App\Http\Requests\Dashboard\CategoryRequest;
use App\Models\Category;
use App\Models\Media;
use App\Rules\TenantExists;
use App\Store\Categories;
use App\Store\SeoDefaults;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

/** «التصنيفات»: the store's category tree. */
final class CategoryController extends Controller
{
    use RespondsWithJson;

    public function __construct(private readonly Categories $categories) {}

    public function index(SeoDefaults $seo): JsonResponse
    {
        $tree = $this->categories->tree();
        $byId = $tree->keyBy('id');
        $store = $seo->storeName();

        return $this->ok($tree->map(function (Category $c) use ($byId, $seo, $store) {
            $ancestors = [];
            for ($p = $byId->get($c->parent_id ?? 0); $p !== null; $p = $byId->get($p->parent_id ?? 0)) {
                $ancestors[] = $p->name;
            }

            return [...$this->row($c), 'seo_defaults' => $seo->category($c, $store, $ancestors)];
        })->values()->all());
    }

    public function store(CategoryRequest $request): JsonResponse
    {
        return $this->created($this->row($this->categories->create($request->validated())->load('image')));
    }

    public function update(CategoryRequest $request, Category $category): JsonResponse
    {
        return $this->ok($this->row($this->categories->update($category, $request->validated())->load('image')));
    }

    /** ?children=lift (default: sub-categories move one level up) | delete (deleted with it, every level). */
    public function destroy(Request $request, Category $category): Response
    {
        $data = $request->validate(['children' => ['nullable', 'string', 'in:lift,delete']]);
        $this->categories->delete($category, ($data['children'] ?? 'lift') === 'delete');

        return $this->noContent();
    }

    public function reorder(Request $request): Response
    {
        $data = $request->validate(['ids' => ['required', 'array', 'max:500'], 'ids.*' => ['integer', 'distinct', TenantExists::table('categories')]]);
        $this->categories->reorder(array_map('intval', $data['ids']));

        return $this->noContent();
    }

    /** @return array<string, mixed> */
    private function row(Category $c): array
    {
        return [
            'id' => $c->id,
            'parent_id' => $c->parent_id,
            'depth' => $c->depth,
            'name' => $c->name,
            'slug' => $c->slug,
            'description' => $c->description,
            'media_id' => $c->media_id,
            'image' => $c->image instanceof Media ? $c->image->urls() : null,
            'is_visible' => $c->is_visible,
            'seo' => $c->seo,
            'position' => $c->position,
            'products_count' => (int) ($c->getAttribute('products_count') ?? 0),
            'locked_by_plan' => $c->isLockedByPlan(),
        ];
    }
}
