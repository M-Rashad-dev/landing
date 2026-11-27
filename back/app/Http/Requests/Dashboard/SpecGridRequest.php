<?php

declare(strict_types=1);

namespace App\Http\Requests\Dashboard;

use App\Http\Requests\ApiRequest;
use App\Rules\TenantExists;
use App\Store\Specs\ProductSpecs;

/**
 * «املأ القيم»: the changed grid rows, each a product and its values by label (a list, so labels with dots or any
 * other character stay plain data). At most 200 rows per call.
 */
final class SpecGridRequest extends ApiRequest
{
    public const MAX = 200;

    protected function prepareForValidation(): void
    {
        $rows = $this->input('rows');
        if (! is_array($rows)) {
            return;
        }
        foreach ($rows as $i => $row) {
            foreach ((is_array($row) ? (array) ($row['values'] ?? []) : []) as $j => $cell) {
                if (! is_array($cell)) {
                    continue;
                }
                foreach (['label', 'value'] as $key) {
                    if (isset($cell[$key]) && is_string($cell[$key])) {
                        $clean = trim(strip_tags($cell[$key]));
                        $rows[$i]['values'][$j][$key] = $key === 'value' && $clean === '' ? null : $clean;
                    }
                }
            }
        }
        $this->merge(['rows' => $rows]);
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'rows' => ['required', 'array', 'min:1', 'max:'.self::MAX],
            'rows.*.product_id' => ['required', 'integer', 'distinct', TenantExists::table('products')],
            'rows.*.values' => ['required', 'array', 'min:1', 'max:'.ProductSpecs::maxRows()],
            'rows.*.values.*.label' => ['required', 'string', 'max:60'],
            'rows.*.values.*.value' => ['present', 'nullable', 'string', 'max:200'],
        ];
    }
}
