<?php

declare(strict_types=1);

namespace App\Http\Requests\Dashboard;

use App\Models\Category;
use App\Rules\PageSlug;
use App\Rules\TenantExists;
use App\Rules\TenantUnique;
use Illuminate\Foundation\Http\FormRequest;

final class CategoryRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        $merge = [];
        foreach (['name', 'description', 'slug'] as $key) {
            if (is_string($this->input($key))) {
                $value = trim(strip_tags($this->input($key)));
                $merge[$key] = $value === '' ? null : $value;
            }
        }
        $this->merge($merge);
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        /** @var Category|null $category */
        $category = $this->route('category');

        return [
            'name' => [$category ? 'sometimes' : 'required', 'string', 'max:100'],
            'slug' => ['nullable', 'string', 'max:120', 'regex:'.PageSlug::PATTERN, TenantUnique::table('categories', 'slug')->ignore($category?->id)],
            'parent_id' => ['nullable', 'integer', TenantExists::table('categories')],
            'description' => ['nullable', 'string', 'max:2000'],
            'media_id' => ['nullable', 'integer', TenantExists::table('media')],
            'is_visible' => ['sometimes', 'boolean'],
            'seo' => ['sometimes', 'nullable', 'array'],
            'seo.title' => ['nullable', 'string', 'max:70'],
            'seo.description' => ['nullable', 'string', 'max:170'],
            'seo.keywords' => ['nullable', 'array', 'max:10'],
            'seo.keywords.*' => ['nullable', 'string', 'max:40'],
        ];
    }
}
