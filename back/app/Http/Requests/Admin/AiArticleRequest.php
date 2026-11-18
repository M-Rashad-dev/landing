<?php

declare(strict_types=1);

namespace App\Http\Requests\Admin;

use App\Models\AiArticle;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/** An article of the support assistant's knowledge base. */
final class AiArticleRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'title' => ['required', 'string', 'max:160'],
            'category' => ['required', Rule::in(AiArticle::CATEGORIES)],
            'body' => ['required', 'string', 'max:20000'],
            'is_active' => ['required', 'boolean'],
        ];
    }
}
