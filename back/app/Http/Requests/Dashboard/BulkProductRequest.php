<?php

declare(strict_types=1);

namespace App\Http\Requests\Dashboard;

use App\Actions\Products\BulkProducts;
use App\Http\Requests\ApiRequest;
use App\Rules\TenantExists;

/** One action on several products chosen in the list. */
final class BulkProductRequest extends ApiRequest
{
    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'action' => ['required', 'string', 'in:'.implode(',', BulkProducts::ACTIONS)],
            'ids' => ['required', 'array', 'min:1', 'max:100'],
            'ids.*' => ['integer', 'distinct', TenantExists::table('products')],
            'category_id' => ['required_if:action,add_category,remove_category', 'nullable', 'integer', TenantExists::table('categories')],
        ];
    }
}
