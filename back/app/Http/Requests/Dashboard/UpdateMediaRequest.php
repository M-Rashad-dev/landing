<?php

declare(strict_types=1);

namespace App\Http\Requests\Dashboard;

use App\Http\Requests\ApiRequest;

final class UpdateMediaRequest extends ApiRequest
{
    protected function prepareForValidation(): void
    {
        if (is_string($this->input('alt'))) {
            $alt = trim(strip_tags($this->input('alt')));
            $this->merge(['alt' => $alt === '' ? null : $alt]);
        }
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'alt' => ['present', 'nullable', 'string', 'max:255'],
        ];
    }
}
