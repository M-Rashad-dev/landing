<?php

declare(strict_types=1);

namespace App\Http\Requests\Dashboard;

use App\Http\Requests\ApiRequest;
use App\Models\Product;
use App\Rules\TenantExists;

/** Edit from the product card: name, price, categories, stock (only when stock is not per combination). */
final class QuickProductRequest extends ApiRequest
{
    protected function prepareForValidation(): void
    {
        if (is_string($this->input('name'))) {
            $this->merge(['name' => trim(strip_tags($this->input('name')))]);
        }
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'name' => ['sometimes', 'required', 'string', 'max:150'],
            'price' => ['sometimes', 'required', 'numeric', 'decimal:0,2', 'gt:0', 'max:9999999.99'],
            'category_ids' => ['sometimes', 'array', 'max:20'],
            'category_ids.*' => ['integer', 'distinct', TenantExists::table('categories')],
            'primary_category_id' => ['sometimes', 'nullable', 'integer', TenantExists::table('categories')],
            'stock_mode' => ['sometimes', 'string', 'in:'.Product::STOCK_UNLIMITED.','.Product::STOCK_PRODUCT],
            'stock' => ['sometimes', 'nullable', 'integer', 'between:0,1000000'],
        ];
    }
}
