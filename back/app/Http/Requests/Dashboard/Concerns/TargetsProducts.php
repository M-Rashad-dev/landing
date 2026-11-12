<?php

declare(strict_types=1);

namespace App\Http\Requests\Dashboard\Concerns;

use App\Enums\PromotionTarget;
use App\Models\Product;
use App\Rules\TenantExists;
use App\Store\Categories;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Validation\Rule;

/**
 * applies_to + product_ids / category_ids of an offer, a code or a shipping offer.
 * Without applies_to: products when product_ids are sent (older clients), else the default.
 */
trait TargetsProducts
{
    abstract protected function defaultTarget(): PromotionTarget;

    public function target(): PromotionTarget
    {
        $value = $this->input('applies_to');
        if (is_string($value) && PromotionTarget::tryFrom($value) !== null) {
            return PromotionTarget::from($value);
        }

        return is_array($this->input('product_ids')) && $this->input('product_ids') !== [] ? PromotionTarget::Products : $this->defaultTarget();
    }

    /** @return array<string, mixed> */
    protected function targetRules(): array
    {
        $target = $this->target();

        return [
            'applies_to' => ['sometimes', 'string', Rule::in(PromotionTarget::values())],
            'product_ids' => $target === PromotionTarget::Products ? ['required', 'array', 'min:1', 'max:100'] : ['nullable', 'array', 'max:100'],
            'product_ids.*' => ['integer', 'distinct', TenantExists::table('products')->ignoreTrashed()],
            'category_ids' => $target === PromotionTarget::Categories ? ['required', 'array', 'min:1', 'max:50'] : ['nullable', 'array', 'max:50'],
            'category_ids.*' => ['integer', 'distinct', TenantExists::table('categories')],
        ];
    }

    /** @return list<int> */
    public function productIds(): array
    {
        return $this->target() === PromotionTarget::Products ? array_values(array_map('intval', (array) $this->validated('product_ids', []))) : [];
    }

    /** @return list<int> */
    public function categoryIds(): array
    {
        return $this->target() === PromotionTarget::Categories ? array_values(array_map('intval', (array) $this->validated('category_ids', []))) : [];
    }

    /**
     * The products covered by what was sent (validation only, before saving).
     *
     * @return Builder<Product>
     */
    protected function coveredProducts(): Builder
    {
        $query = Product::query();

        return match ($this->target()) {
            PromotionTarget::All => $query,
            PromotionTarget::Products => $query->whereIn('id', array_map('intval', (array) $this->input('product_ids', []))),
            PromotionTarget::Categories => $query->whereHas('categories', fn ($q) => $q->whereIn('categories.id', $this->categoriesWithChildren())),
        };
    }

    /** @return list<int> */
    private function categoriesWithChildren(): array
    {
        $categories = app(Categories::class);
        $ids = [];
        foreach (array_map('intval', (array) $this->input('category_ids', [])) as $id) {
            array_push($ids, ...$categories->withDescendants($id));
        }

        return $ids === [] ? [0] : array_values(array_unique($ids));
    }
}
