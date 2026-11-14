<?php

declare(strict_types=1);

namespace App\Http\Requests\Dashboard;

use App\Http\Requests\ApiRequest;
use App\Imports\Products\ColumnMapper;
use App\Models\ProductImport;
use Illuminate\Validation\Validator;

/**
 * The confirmed mapping (field → column index; `images` may list several columns) and the choices:
 * match existing products by SKU or not, update or skip them, new products visible or hidden.
 */
final class ProductImportStartRequest extends ApiRequest
{
    /** @return array<string, mixed> */
    public function rules(): array
    {
        $rules = [
            'mapping' => ['required', 'array'],
            'options' => ['required', 'array'],
            'options.match' => ['required', 'string', 'in:sku,none'],
            'options.existing' => ['required', 'string', 'in:update,skip'],
            'options.visible' => ['required', 'boolean'],
        ];
        foreach (ColumnMapper::FIELDS as $field) {
            $rules["mapping.{$field}"] = in_array($field, ColumnMapper::MULTI, true)
                ? ['sometimes', 'nullable', 'array', 'max:10']
                : ['sometimes', 'nullable', 'integer', 'min:0'];
            if (in_array($field, ColumnMapper::MULTI, true)) {
                $rules["mapping.{$field}.*"] = ['integer', 'min:0', 'distinct'];
            }
        }

        return $rules;
    }

    public function after(): array
    {
        return [function (Validator $validator): void {
            if ($validator->errors()->isNotEmpty()) {
                return;
            }
            /** @var ProductImport $import */
            $import = $this->route('productImport');
            $width = count($import->headers);
            $used = [];
            foreach ($this->mapping() as $field => $columns) {
                foreach ((array) $columns as $column) {
                    if ($column >= $width) {
                        $validator->errors()->add("mapping.{$field}", __('imports.mapping_column'));
                    } elseif (isset($used[$column])) {
                        $validator->errors()->add("mapping.{$field}", __('imports.mapping_twice'));
                    }
                    $used[$column] = true;
                }
            }
            $mapping = $this->mapping();
            $updatesOnly = $this->input('options.match') === 'sku' && $this->input('options.existing') === 'update';
            // Name and price may be left out only to update existing products by SKU (e.g. stock and prices).
            if (! isset($mapping['name']) && ! ($updatesOnly && isset($mapping['sku']))) {
                $validator->errors()->add('mapping.name', __('imports.mapping_name'));
            }
            if (! isset($mapping['price']) && ! isset($mapping['sale_price']) && ! ($updatesOnly && isset($mapping['sku']))) {
                $validator->errors()->add('mapping.price', __('imports.mapping_price'));
            }
        }];
    }

    /** @return array<string, int|list<int>> the mapping without empty fields */
    public function mapping(): array
    {
        $out = [];
        foreach (ColumnMapper::FIELDS as $field) {
            $value = $this->input("mapping.{$field}");
            if ($value === null || $value === [] || $value === '') {
                continue;
            }
            $out[$field] = is_array($value) ? array_values(array_map('intval', $value)) : (int) $value;
        }

        return $out;
    }
}
