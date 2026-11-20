<?php

declare(strict_types=1);

namespace App\Http\Requests\Dashboard;

use App\Http\Requests\ApiRequest;
use App\Models\CopilotMessage;
use App\Rules\TenantExists;

/** A merchant message to the store copilot: text, up to 4 images, and the page he is on (checked by CopilotChats). */
final class CopilotMessageRequest extends ApiRequest
{
    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'text' => ['required', 'string', 'min:1', 'max:2000'],
            'media_ids' => ['nullable', 'array', 'max:'.CopilotMessage::MAX_IMAGES],
            'media_ids.*' => ['integer', 'distinct', TenantExists::table('media')],
            'import_id' => ['nullable', 'integer', TenantExists::table('product_imports')],
            'context' => ['nullable', 'array'],
            'context.page' => ['nullable', 'string', 'max:200'],
            'context.entity' => ['nullable', 'array'],
            'context.entity.type' => ['required_with:context.entity', 'string', 'max:40'],
            'context.entity.id' => ['required_with:context.entity', 'integer', 'min:1'],
            'context.selection' => ['nullable', 'array'],
            'context.selection.type' => ['required_with:context.selection', 'string', 'max:40'],
            'context.selection.ids' => ['required_with:context.selection', 'array', 'max:500'],
            'context.selection.ids.*' => ['integer', 'min:1'],
        ];
    }

    /** @return list<int> */
    public function mediaIds(): array
    {
        return array_values(array_map('intval', (array) ($this->validated('media_ids') ?? [])));
    }

    public function importId(): ?int
    {
        return $this->validated('import_id') === null ? null : (int) $this->validated('import_id');
    }

    /** @return array<string, mixed> */
    public function context(): array
    {
        return (array) ($this->validated('context') ?? []);
    }
}
