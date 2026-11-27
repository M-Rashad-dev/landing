<?php

declare(strict_types=1);

namespace App\Http\Requests\Dashboard;

use App\Http\Requests\ApiRequest;
use App\Models\SpecGroup;
use App\Rules\TenantUnique;
use App\Store\Specs\ProductSpecs;
use Illuminate\Validation\Validator;

/** A spec group: its name and its rows (labels with the two flags), replaced in order on update. */
final class SpecGroupRequest extends ApiRequest
{
    protected function prepareForValidation(): void
    {
        $merge = [];
        if (is_string($this->input('name'))) {
            $merge['name'] = trim(strip_tags($this->input('name')));
        }
        $rows = $this->input('rows');
        if (is_array($rows)) {
            foreach ($rows as $i => $row) {
                if (is_array($row) && isset($row['label']) && is_string($row['label'])) {
                    $rows[$i]['label'] = trim(strip_tags($row['label']));
                }
            }
            $merge['rows'] = $rows;
        }
        $this->merge($merge);
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        /** @var SpecGroup|null $group */
        $group = $this->route('specGroup');

        return [
            'name' => ['required', 'string', 'max:60', TenantUnique::table('spec_groups', 'name')->ignore($group?->id)],
            'rows' => ['required', 'array', 'min:1', 'max:'.ProductSpecs::maxRows()],
            'rows.*' => ['array'],
            'rows.*.label' => ['required', 'string', 'max:60'],
            'rows.*.in_card' => ['sometimes', 'boolean'],
            'rows.*.filterable' => ['sometimes', 'boolean'],
        ];
    }

    public function after(): array
    {
        return [function (Validator $validator): void {
            if ($validator->errors()->isNotEmpty()) {
                return;
            }
            $seen = [];
            $cards = 0;
            foreach ((array) $this->input('rows') as $i => $row) {
                $key = ProductSpecs::key((string) $row['label']);
                if (isset($seen[$key])) {
                    $validator->errors()->add("rows.{$i}.label", __('specs.label_duplicate'));
                }
                $seen[$key] = true;
                if (filter_var($row['in_card'] ?? false, FILTER_VALIDATE_BOOLEAN) && ++$cards > ProductSpecs::maxCardRows()) {
                    $validator->errors()->add("rows.{$i}.in_card", __('specs.too_many_card_rows', ['max' => ProductSpecs::maxCardRows()]));
                }
            }
        }];
    }
}
