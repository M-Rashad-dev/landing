<?php

declare(strict_types=1);

namespace App\Http\Requests\Dashboard;

use App\Models\AiSection;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

final class AiSectionIndexRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'kind' => ['required', 'string', Rule::in(AiSection::KINDS)],
            'theme_key' => ['required', 'string', 'max:60'],
        ];
    }
}
