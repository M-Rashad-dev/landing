<?php

declare(strict_types=1);

namespace App\Http\Requests\Dashboard;

use App\Models\AiChatMessage;
use App\Rules\TenantExists;
use Illuminate\Foundation\Http\FormRequest;

final class AiDesignerMessageRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'text' => ['required', 'string', 'min:1', 'max:2000'],
            'media_ids' => ['nullable', 'array', 'max:'.AiChatMessage::MAX_IMAGES],
            'media_ids.*' => ['integer', 'distinct', TenantExists::table('media')],
            'focus_section_id' => ['nullable', 'integer', TenantExists::table('ai_sections')],
        ];
    }
}
