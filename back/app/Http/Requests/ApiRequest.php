<?php

declare(strict_types=1);

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

abstract class ApiRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, string> */
    public function attributes(): array
    {
        /** @var array<string, string> $attributes */
        $attributes = trans('attributes');

        return is_array($attributes) ? $attributes : [];
    }
}
