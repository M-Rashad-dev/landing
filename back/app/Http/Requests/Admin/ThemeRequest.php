<?php

declare(strict_types=1);

namespace App\Http\Requests\Admin;

use App\Rules\CairoDateTime;
use App\Support\CairoTime;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

/** Theme store details of one theme (the theme itself is code). */
final class ThemeRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:100'],
            'kind' => ['required', Rule::in(['landing', 'store'])],
            'short_description' => ['nullable', 'string', 'max:200'],
            'description' => ['nullable', 'string', 'max:3000'],
            'features' => ['nullable', 'array', 'max:12'],
            'features.*' => ['string', 'max:120'],
            'price' => ['required', 'numeric', 'min:0', 'max:1000000', 'decimal:0,2'],
            'discount_percent' => ['nullable', 'integer', 'between:0,'.(int) config('landing.billing.max_discount_percent')],
            'discount_starts_at' => ['nullable', new CairoDateTime],
            'discount_ends_at' => ['nullable', new CairoDateTime],
            'min_plan_key' => ['nullable', 'string', Rule::exists('plans', 'key')],
            'is_featured' => ['required', 'boolean'],
            'is_listed' => ['required', 'boolean'],
            'version' => ['nullable', 'string', 'max:20'],
            'released_at' => ['nullable', new CairoDateTime],
            'tag_ids' => ['nullable', 'array', 'max:20'],
            'tag_ids.*' => ['integer', 'distinct', Rule::exists('theme_tags', 'id')],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $v): void {
            $starts = CairoTime::parse($this->input('discount_starts_at'));
            $ends = CairoTime::parse($this->input('discount_ends_at'));
            if ($starts !== null && $ends !== null && $ends->lte($starts)) {
                $v->errors()->add('discount_ends_at', __('validation.after', ['attribute' => 'نهاية الخصم', 'date' => 'بدايته']));
            }
        });
    }
}
