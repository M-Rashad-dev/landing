<?php

declare(strict_types=1);

namespace App\Http\Requests\Dashboard;

use Illuminate\Foundation\Http\FormRequest;

final class AiDesignerApproveRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        if ($this->has('name') && is_string($this->input('name'))) {
            $trimmed = trim($this->input('name'));
            $this->merge(['name' => $trimmed === '' ? null : $trimmed]);
        }
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'name' => ['nullable', 'string', 'min:1', 'max:100'],
            'mode' => ['nullable', 'string', 'in:replace,new'],
        ];
    }
}
