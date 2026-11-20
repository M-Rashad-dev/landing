<?php

declare(strict_types=1);

namespace App\Ai\Copilot\Resources;

use App\Ai\Copilot\Contracts\CopilotResource;
use App\Ai\Copilot\Contracts\Field;
use App\Ai\Copilot\CopilotContext;
use App\Models\Product;
use App\Store\ProductList;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;

/** «المنتجات»: the store's products (also the ones its landing pages sell). Status tabs and sorts come from ProductList. */
final class ProductsResource extends CopilotResource
{
    public function key(): string
    {
        return 'products';
    }

    public function label(): string
    {
        return 'المنتجات';
    }

    public function summary(): string
    {
        return 'Products: price, old price, stock (stock_mode unlimited | product | variant; variant products keep stock per option), active or not, categories.';
    }

    public function model(): string
    {
        return Product::class;
    }

    public function fields(): array
    {
        return [
            Field::text('name')->label('الاسم')->sortable(),
            Field::text('sku')->label('SKU')->filterable(),
            Field::money('price')->label('السعر')->filterable()->sortable(),
            Field::money('compare_at_price')->label('السعر قبل الخصم')->filterable()->nullable(),
            Field::bool('is_active')->label('شغال')->filterable(),
            Field::enum('stock_mode', [Product::STOCK_UNLIMITED, Product::STOCK_PRODUCT, Product::STOCK_VARIANT])->label('نوع المخزون')
                ->labels([Product::STOCK_UNLIMITED => 'غير محدود', Product::STOCK_PRODUCT => 'للمنتج', Product::STOCK_VARIANT => 'لكل اختيار'])->filterable(),
            Field::int('stock')->label('المخزون')->filterable()->sortable(),
            Field::text('categories')->label('التصنيفات')->using(fn (Model $p) => $p->relationLoaded('categories') ? $p->categories->pluck('name')->all() : []),
            Field::date('created_at')->label('اتضاف')->filterable()->sortable(),
        ];
    }

    public function namedFilters(): array
    {
        return [
            'q' => ['type' => 'string', 'description' => 'Search in name and SKU.'],
            'status' => ['type' => 'string', 'enum' => ProductList::STATUSES, 'description' => 'active, inactive, out (out of stock), low (at or under the low-stock alert).'],
            'category_id' => ['type' => 'integer', 'description' => 'A category id (its sub-categories included).'],
            'sort' => ['type' => 'string', 'enum' => ProductList::SORTS],
        ];
    }

    public function base(array $named, CopilotContext $ctx): Builder
    {
        return app(ProductList::class)->query([
            'q' => isset($named['q']) && is_scalar($named['q']) ? mb_substr((string) $named['q'], 0, 100) : null,
            'status' => self::pick($named, 'status', ProductList::STATUSES),
            'category_id' => self::pickId($named, 'category_id'),
            'sort' => self::pick($named, 'sort', ProductList::SORTS),
        ]);
    }

    public function with(): array
    {
        return ['categories:id,name'];
    }

    public function url(?Model $row): ?string
    {
        return $row === null ? '/dashboard/catalog/products' : "/dashboard/catalog/products/{$row->getKey()}";
    }
}
