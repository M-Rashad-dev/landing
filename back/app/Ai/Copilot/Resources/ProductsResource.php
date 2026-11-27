<?php

declare(strict_types=1);

namespace App\Ai\Copilot\Resources;

use App\Actions\Products\DeleteProduct;
use App\Actions\Products\SaveProduct;
use App\Ai\Copilot\Contracts\CopilotResource;
use App\Ai\Copilot\Contracts\Field;
use App\Ai\Copilot\CopilotContext;
use App\Auth\PermissionCatalog;
use App\Enums\PlanLimit;
use App\Http\Requests\Dashboard\ProductRequest;
use App\Imports\Products\SpecCells;
use App\Models\Category;
use App\Models\Product;
use App\Models\ProductSpecRow;
use App\Store\ProductList;
use App\Store\Specs\ProductSpecs;
use App\Store\Stock;
use App\Support\Money;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Foundation\Http\FormRequest;

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
        return 'Products: price, old price, stock (stock_mode unlimited | product | variant; variant products keep stock per option), active or not, categories, digital products (kind digital, delivered by email once paid: files, codes, a link or a service the merchant does; codes_left for codes products), «حسب الطلب» fields (inputs: what the customer types or uploads when buying — a text, a long text, an image or a file — with its extra price; set on the product form), «المواصفات» (specs: spec tables like «لابتوب: 12 صف», each row a label and a plain-text value; filled with the action products.fill_specs; reusable tables are the resource spec_groups).';
    }

    public function model(): string
    {
        return Product::class;
    }

    public function fields(): array
    {
        return [
            Field::text('name')->label('الاسم')->sortable()->editable(),
            Field::text('sku')->label('SKU')->filterable(),
            Field::money('price')->label('السعر')->filterable()->sortable()->bulk()->rules(['required', 'numeric', 'gt:0', 'max:9999999.99']),
            Field::money('compare_at_price')->label('السعر قبل الخصم')->filterable()->nullable()->bulk()->rules(['nullable', 'numeric', 'max:9999999.99']),
            // The unit cost (profit), only for whoever has «تكلفة المنتجات» (the copilot runs as that user).
            ...(PermissionCatalog::allows(auth()->user(), 'products.cost') ? [Field::money('cost')->label('التكلفة')->filterable()->nullable()->bulk()->rules(['nullable', 'numeric', 'min:0', 'max:9999999.99'])] : []),
            Field::bool('is_active')->label('شغال')->filterable()->bulk(),
            Field::enum('stock_mode', [Product::STOCK_UNLIMITED, Product::STOCK_PRODUCT, Product::STOCK_VARIANT])->label('نوع المخزون')
                ->labels([Product::STOCK_UNLIMITED => 'غير محدود', Product::STOCK_PRODUCT => 'للمنتج', Product::STOCK_VARIANT => 'لكل اختيار'])->filterable(),
            // Full path (SaveProduct logs the stock movement); variant products keep stock per option.
            Field::int('stock')->label('المخزون')->filterable()->sortable()->editable()->rules(['integer', 'between:0,1000000']),
            Field::text('categories')->label('التصنيفات')->using(fn (Model $p) => $p->relationLoaded('categories') ? $p->categories->pluck('name')->all() : []),
            Field::ids('category_ids')->label('التصنيفات (أرقام)')->notInTable()->editable()
                ->using(fn (Model $p) => $p->relationLoaded('categories') ? $p->categories->pluck('id')->map(fn ($id) => (int) $id)->all() : [])
                ->names(fn (array $ids) => Category::query()->whereIn('id', $ids)->pluck('name')->all()),
            Field::textarea('short_description')->label('وصف قصير')->notInTable()->editable(),
            Field::textarea('description')->label('الوصف')->notInTable()->editable(),
            Field::text('seo_title')->label('عنوان SEO')->notInTable()->editable()->using(fn (Model $p) => ((array) ($p->getAttribute('seo') ?? []))['title'] ?? null),
            Field::text('seo_description')->label('وصف SEO')->notInTable()->editable()->using(fn (Model $p) => ((array) ($p->getAttribute('seo') ?? []))['description'] ?? null),
            Field::ids('media_ids')->label('الصور')->images()->notInTable()->editable()
                ->using(fn (Model $p) => $p->relationLoaded('media') ? $p->media->pluck('id')->map(fn ($id) => (int) $id)->all() : []),
            // «منتج رقمي»: delivered by email after payment; codes products count their codes left (never the codes).
            Field::enum('kind', [Product::PHYSICAL, Product::DIGITAL])->label('النوع')->labels([Product::PHYSICAL => 'عادي', Product::DIGITAL => 'رقمي'])->filterable(),
            Field::text('delivery_type')->label('التسليم')->using(fn (Model $p) => $p->getAttribute('delivery_type')?->label()),
            Field::int('codes_left')->label('الأكواد الباقية')->notInTable()->using(fn (Model $p) => $p instanceof Product && $p->deliversCodes() ? array_sum(app(Stock::class)->codeStock($p)) : null),
            Field::text('inputs')->label('خانات حسب الطلب')->notInTable()
                ->using(fn (Model $p) => $p->relationLoaded('inputs') ? $p->inputs->map(fn ($i) => $i->label.' ('.$i->kind->label().($i->is_required ? '، إجباري' : '').((float) $i->price_delta > 0 ? '، +'.$i->price_delta : '').')')->all() : []),
            // «المواصفات»: «لابتوب: 12 صف (9 متعبّية)» per table (values: the product page; written by products.fill_specs).
            Field::text('specs')->label('المواصفات')->notInTable()
                ->using(fn (Model $p) => $p->relationLoaded('specTables') ? $p->specTables->map(fn ($t) => (string) __('ai.copilot.specs_summary', ['name' => $t->name, 'rows' => $t->rows->count(), 'filled' => $t->rows->filter(fn ($r) => trim((string) $r->value) !== '')->count()]))->all() : []),
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
        return ['categories:id,name', 'media', 'inputs', 'specTables.rows'];
    }

    public function request(): ?string
    {
        return ProductRequest::class;
    }

    /** «{الجدول}: {الصف}» columns (the import reads them back), in the order they first appear; at most 200. */
    public function exportColumns(Builder $query): ?array
    {
        $pairs = ProductSpecRow::query()
            ->join('product_spec_tables', 'product_spec_tables.id', '=', 'product_spec_rows.product_spec_table_id')
            ->whereIn('product_spec_tables.product_id', $query->clone()->reorder()->select('products.id'))
            ->distinct()
            ->get(['product_spec_tables.name', 'product_spec_rows.label', 'product_spec_tables.position as table_position', 'product_spec_rows.position as row_position']);
        if ($pairs->isEmpty()) {
            return null;
        }
        $first = [];
        foreach ($pairs as $pair) {
            $key = ProductSpecs::key((string) $pair->getAttribute('name')).'|'.ProductSpecs::key((string) $pair->getAttribute('label'));
            $order = [(int) $pair->getAttribute('table_position'), (int) $pair->getAttribute('row_position')];
            if (! isset($first[$key]) || $order < $first[$key]['order']) {
                $first[$key] = ['order' => $order, 'header' => SpecCells::header((string) $pair->getAttribute('name'), (string) $pair->getAttribute('label'))];
            }
        }
        uasort($first, fn (array $a, array $b) => $a['order'] <=> $b['order']);
        $columns = array_slice($first, 0, 200, true);

        return [
            'headers' => array_values(array_map(fn (array $c) => $c['header'], $columns)),
            'cells' => function (Model $product) use ($columns): array {
                $values = [];
                foreach ($product instanceof Product ? $product->specTables : [] as $table) {
                    foreach ($table->rows as $row) {
                        $values[ProductSpecs::key($table->name).'|'.ProductSpecs::key($row->label)] = (string) ($row->value ?? '');
                    }
                }

                return array_values(array_map(fn (string $key) => $values[$key] ?? '', array_keys($columns)));
            },
        ];
    }

    public function routeParameter(): string
    {
        return 'product';
    }

    /** The fields SaveProduct overwrites when missing: always sent with a change. */
    public function body(Model $row): array
    {
        return [
            'name' => $row->getAttribute('name'),
            'description' => $row->getAttribute('description'),
            'price' => (string) $row->getAttribute('price'),
            'compare_at_price' => $row->getAttribute('compare_at_price') === null ? null : (string) $row->getAttribute('compare_at_price'),
            'sku' => $row->getAttribute('sku'),
            'is_active' => (bool) $row->getAttribute('is_active'),
        ];
    }

    /** seo_title / seo_description go into the product's seo (its other SEO keys kept). */
    public function requestData(array $after, Model $row): array
    {
        $after = parent::requestData($after, $row);
        if (array_key_exists('seo_title', $after) || array_key_exists('seo_description', $after)) {
            $seo = (array) ($row->getAttribute('seo') ?? []);
            foreach (['seo_title' => 'title', 'seo_description' => 'description'] as $field => $key) {
                if (array_key_exists($field, $after)) {
                    $seo[$key] = $after[$field];
                    unset($after[$field]);
                }
            }
            $after['seo'] = $seo;
        }

        return $after;
    }

    public function persist(FormRequest $validated, ?Model $row): Model
    {
        // The batch refreshes the store once at the end (afterBulk).
        return app(SaveProduct::class)->handle($validated->validated(), $row instanceof Product ? $row : null, false);
    }

    public function draft(): array
    {
        return ['is_active' => false];
    }

    public function publish(): array
    {
        return ['is_active' => true];
    }

    public function remove(Model $row): void
    {
        app(DeleteProduct::class)->handle($row instanceof Product ? $row : throw new \LogicException('Not a product.'));
    }

    public function limit(): ?PlanLimit
    {
        return PlanLimit::Products;
    }

    public function createFields(): array
    {
        return [
            'name' => 'required, ≤ 150',
            'price' => 'required, EGP',
            'compare_at_price' => 'old price, above price',
            'description' => 'long description (plain text)',
            'short_description' => '≤ 300',
            'sku' => '≤ 60',
            'category_ids' => 'list of category ids',
            'stock_mode' => 'unlimited | product',
            'stock' => 'with stock_mode product',
        ];
    }

    public function validateRow(array $after, Model $row): ?string
    {
        if (array_key_exists('stock', $after) && $row->getAttribute('stock_mode') !== Product::STOCK_PRODUCT) {
            return $row->getAttribute('stock_mode') === Product::STOCK_VARIANT ? 'المخزون هنا لكل اختيار، عدّله من صفحة المنتج' : 'المنتج ده مخزونه غير محدود';
        }
        $price = array_key_exists('price', $after) ? $after['price'] : $row->getAttribute('price');
        $compare = array_key_exists('compare_at_price', $after) ? $after['compare_at_price'] : $row->getAttribute('compare_at_price');
        if ($compare !== null && $compare !== '' && Money::toCents((string) $compare) <= Money::toCents((string) $price)) {
            return 'السعر قبل الخصم لازم يبقى أكبر من السعر';
        }

        return null;
    }

    public function url(?Model $row): ?string
    {
        return $row === null ? '/dashboard/catalog/products' : "/dashboard/catalog/products/{$row->getKey()}";
    }
}
