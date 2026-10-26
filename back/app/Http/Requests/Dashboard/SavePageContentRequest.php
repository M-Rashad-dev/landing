<?php

declare(strict_types=1);

namespace App\Http\Requests\Dashboard;

use App\Http\Requests\ApiRequest;
use Illuminate\Validation\Rule;

final class SavePageContentRequest extends ApiRequest
{
    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'version' => ['required', 'integer', 'min:1'],
            'theme_key' => ['nullable', 'string', Rule::exists('themes', 'key')->where('is_active', true)],
            'content' => ['required', 'array'],
        ];
    }

    /** @return array<string, string> */
    public function messages(): array
    {
        return ['theme_key.exists' => __('pages.theme_inactive')];
    }
}
