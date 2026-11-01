<?php

declare(strict_types=1);

namespace App\Http\Requests\Public;

use Illuminate\Foundation\Http\FormRequest;

final class PublicQuoteRequest extends FormRequest
{
    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'host' => ['required', 'string', 'max:253'],
            'slug' => ['present', 'nullable', 'string', 'max:100'],
            'quantity' => ['required', 'integer', 'between:1,20'],
            'options' => ['nullable', 'array', 'max:20'],
            'options.*' => ['nullable', 'integer'],
            'code' => ['nullable', 'string', 'max:30'],
            'phone' => ['nullable', 'string', 'max:30'],
            'governorate' => ['nullable', 'string', 'max:60'],
            'offer_id' => ['nullable', 'integer', 'min:0'],
            'ip' => ['nullable', 'ip'],
        ];
    }
}
