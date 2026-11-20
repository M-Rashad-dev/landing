<?php

declare(strict_types=1);

namespace App\Ai\Copilot\Resources;

use App\Ai\Copilot\Contracts\CopilotResource;
use App\Ai\Copilot\Contracts\Field;
use App\Ai\Copilot\CopilotContext;
use App\Enums\PlanLimit;
use App\Http\Requests\Dashboard\CategoryRequest;
use App\Models\Category;
use App\Store\Categories;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Foundation\Http\FormRequest;

/** «التصنيفات» of the store (a tree up to 5 levels). */
final class CategoriesResource extends CopilotResource
{
    public function key(): string
    {
        return 'categories';
    }

    public function label(): string
    {
        return 'التصنيفات';
    }

    public function summary(): string
    {
        return 'Store categories (a tree): name, parent, level, shown or hidden, products count.';
    }

    public function available(CopilotContext $ctx): bool
    {
        return $ctx->hasStore();
    }

    public function model(): string
    {
        return Category::class;
    }

    public function query(CopilotContext $ctx): Builder
    {
        return Category::query()->withCount('products');
    }

    public function fields(): array
    {
        return [
            Field::text('name')->label('الاسم')->searchable()->sortable()->editable(),
            Field::text('parent')->label('التصنيف الأب')->using(fn (Model $c) => $c->relationLoaded('parent') ? $c->parent?->name : null),
            Field::int('depth')->label('المستوى')->filterable(),
            Field::bool('is_visible')->label('ظاهر')->filterable()->bulk(),
            Field::textarea('description')->label('الوصف')->notInTable()->editable(),
            Field::int('products_count')->label('المنتجات')->using(fn (Model $c) => (int) $c->getAttribute('products_count')),
        ];
    }

    public function with(): array
    {
        return ['parent:id,name'];
    }

    public function request(): ?string
    {
        return CategoryRequest::class;
    }

    public function routeParameter(): string
    {
        return 'category';
    }

    /** CategoryRequest takes partial updates: only the change is sent. */
    public function body(Model $row): array
    {
        return [];
    }

    public function persist(FormRequest $validated, ?Model $row): Model
    {
        $categories = app(Categories::class);

        return $row instanceof Category ? $categories->update($row, $validated->validated()) : $categories->create($validated->validated());
    }

    public function draft(): array
    {
        return ['is_visible' => false];
    }

    public function publish(): array
    {
        return ['is_visible' => true];
    }

    /** Sub-categories move one level up, products only leave it (the dashboard's default delete). */
    public function remove(Model $row): void
    {
        app(Categories::class)->delete($row instanceof Category ? $row : throw new \LogicException('Not a category.'));
    }

    public function limit(): ?PlanLimit
    {
        return PlanLimit::StoreCategories;
    }

    public function createFields(): array
    {
        return ['name' => 'required, ≤ 100', 'parent_id' => 'a category id to nest under (optional)', 'description' => '≤ 2000'];
    }

    public function url(?Model $row): ?string
    {
        return '/dashboard/catalog/categories';
    }
}
