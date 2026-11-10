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
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

/** «التصنيفات»: the store's category tree. */
final class CategoryController extends Controller
{
    use RespondsWithJson;

    public function __construct(private readonly Categories $categories) {}

    public function index(): JsonResponse
    {
        $tree = $this->categories->tree()->load('image');

        return $this->ok($tree->map(fn (Category $c) => $this->row($c))->values()->all());
    }

    public function store(CategoryRequest $request): JsonResponse
    {
        return $this->created($this->row($this->categories->create($request->validated())->load('image')));
    }

    public function update(CategoryRequest $request, Category $category): JsonResponse
    {
        return $this->ok($this->row($this->categories->update($category, $request->validated())->load('image')));
    }

    public function destroy(Category $category): Response
    {
        $this->categories->delete($category);

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
