<?php

declare(strict_types=1);

namespace App\Store;

use App\Billing\Entitlements;
use App\Enums\PlanFeature;
use App\Enums\PlanLimit;
use App\Jobs\RevalidateTenantHosts;
use App\Models\Category;
use App\Support\Slugs;
use App\Tenancy\Tenancy;
use Illuminate\Database\Eloquent\Collection as EloquentCollection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * The category tree: a parent may not be the category itself or one of its descendants,
 * depth is capped (config landing.limits.category_depth), depths are kept on every move,
 * deleting a category moves its children up and only unlinks its products.
 */
final class Categories
{
    public function __construct(private readonly Entitlements $entitlements) {}

    /** @param array<string, mixed> $data validated CategoryRequest data */
    public function create(array $data): Category
    {
        $this->entitlements->ensure(PlanFeature::Store);
        $this->entitlements->ensureCanAdd(PlanLimit::StoreCategories);

        return $this->save(new Category, $data);
    }

    /** @param array<string, mixed> $data */
    public function update(Category $category, array $data): Category
    {
        return $this->save($category, $data);
    }

    public function delete(Category $category): void
    {
        DB::transaction(function () use ($category): void {
            foreach ($category->children()->get() as $child) {
                $child->forceFill(['parent_id' => $category->parent_id])->save();
                $this->refreshDepths($child);
            }
            $category->products()->detach();
            $category->delete();
        });
        RevalidateTenantHosts::dispatch((int) Tenancy::id())->afterCommit();
    }

    /** @param list<int> $ids siblings in their new order */
    public function reorder(array $ids): void
    {
        DB::transaction(function () use ($ids): void {
            foreach (array_values($ids) as $position => $id) {
                Category::query()->whereKey($id)->update(['position' => $position]);
            }
        });
        RevalidateTenantHosts::dispatch((int) Tenancy::id())->afterCommit();
    }

    /** All categories of the store, parents before children, in display order. @return EloquentCollection<int, Category> */
    public function tree(): EloquentCollection
    {
        $all = Category::query()->with('image')->withCount('products')->orderBy('position')->orderBy('id')->get();
        $byParent = $all->groupBy(fn (Category $c) => $c->parent_id ?? 0);
        $out = new EloquentCollection;
        $walk = function (int $parentId) use (&$walk, $byParent, $out): void {
            foreach ($byParent->get($parentId, collect()) as $category) {
                $out->push($category);
                $walk($category->id);
            }
        };
        $walk(0);

        return $out;
    }

    /** Ids of the category and every category under it. @return list<int> */
    public function withDescendants(int $id): array
    {
        $all = Category::query()->get(['id', 'parent_id'])->groupBy(fn (Category $c) => $c->parent_id ?? 0);
        $ids = [$id];
        for ($i = 0; $i < count($ids); $i++) {
            foreach ($all->get($ids[$i], collect()) as $child) {
                $ids[] = $child->id;
            }
        }

        return $ids;
    }

    /** @param array<string, mixed> $data */
    private function save(Category $category, array $data): Category
    {
        $parentId = array_key_exists('parent_id', $data) ? ($data['parent_id'] === null ? null : (int) $data['parent_id']) : $category->parent_id;
        $depth = 0;

        if ($parentId !== null) {
            if ($category->exists && in_array($parentId, $this->withDescendants($category->id), true)) {
                throw ValidationException::withMessages(['parent_id' => [__('store.category_cycle')]]);
            }
            $parent = Category::query()->findOrFail($parentId);
            $depth = $parent->depth + 1;
            $subtree = $category->exists ? $this->subtreeHeight($category) : 0;
            $max = (int) config('landing.limits.category_depth') - 1;
            if ($depth + $subtree > $max) {
                throw ValidationException::withMessages(['parent_id' => [__('store.category_depth', ['max' => $max + 1])]]);
            }
        }

        $category = DB::transaction(function () use ($category, $data, $parentId, $depth): Category {
            $category->fill([
                'parent_id' => $parentId,
                'depth' => $depth,
                'name' => $data['name'] ?? $category->name,
                'description' => array_key_exists('description', $data) ? $data['description'] : $category->description,
                'media_id' => array_key_exists('media_id', $data) ? $data['media_id'] : $category->media_id,
                'is_visible' => (bool) ($data['is_visible'] ?? $category->is_visible ?? true),
                'seo' => array_key_exists('seo', $data) ? (array_filter((array) $data['seo'], fn ($v) => $v !== null && $v !== '') ?: null) : $category->seo,
            ]);
            if (! empty($data['slug'])) {
                $category->slug = (string) $data['slug'];
            } elseif (! $category->exists) {
                $category->slug = Slugs::unique(Category::query(), (string) $data['name']);
            }
            if (! $category->exists) {
                $category->position = (int) Category::query()->where('parent_id', $parentId)->max('position') + 1;
            }
            $category->save();
            $this->refreshDepths($category);

            return $category;
        });
        RevalidateTenantHosts::dispatch((int) Tenancy::id())->afterCommit();

        return $category;
    }

    private function refreshDepths(Category $category): void
    {
        $parentDepth = $category->parent_id === null ? -1 : (int) Category::query()->whereKey($category->parent_id)->value('depth');
        $category->forceFill(['depth' => $parentDepth + 1])->save();
        foreach ($category->children()->get() as $child) {
            $this->refreshDepths($child);
        }
    }

    private function subtreeHeight(Category $category): int
    {
        $height = 0;
        foreach ($category->children()->get() as $child) {
            $height = max($height, 1 + $this->subtreeHeight($child));
        }

        return $height;
    }
}
