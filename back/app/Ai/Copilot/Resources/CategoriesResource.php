<?php

declare(strict_types=1);

namespace App\Ai\Copilot\Resources;

use App\Ai\Copilot\Contracts\CopilotResource;
use App\Ai\Copilot\Contracts\Field;
use App\Ai\Copilot\CopilotContext;
use App\Models\Category;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;

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
            Field::text('name')->label('الاسم')->searchable()->sortable(),
            Field::text('parent')->label('التصنيف الأب')->using(fn (Model $c) => $c->relationLoaded('parent') ? $c->parent?->name : null),
            Field::int('depth')->label('المستوى')->filterable(),
            Field::bool('is_visible')->label('ظاهر')->filterable(),
            Field::int('products_count')->label('المنتجات')->using(fn (Model $c) => (int) $c->getAttribute('products_count')),
        ];
    }

    public function with(): array
    {
        return ['parent:id,name'];
    }

    public function url(?Model $row): ?string
    {
        return '/dashboard/catalog/categories';
    }
}
