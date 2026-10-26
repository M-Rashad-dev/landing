<?php

declare(strict_types=1);

namespace App\Http\Requests\Dashboard;

use App\Http\Requests\ApiRequest;

final class UpdateStoreRequest extends ApiRequest
{
    protected function prepareForValidation(): void
    {
        if (is_string($this->input('name'))) {
            $this->merge(['name' => trim($this->input('name'))]);
        }
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'min:2', 'max:100'],
        ];
    }

    /** @return array<string, string> */
    public function attributes(): array
    {
        return array_merge(parent::attributes(), ['name' => __('attributes.store_name')]);
    }
}
