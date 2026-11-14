<?php

declare(strict_types=1);

namespace App\Http\Requests\Dashboard;

use App\Enums\SupportTopic;
use Illuminate\Validation\Rule;

/** Opening a support conversation: its topic, the first message, and the page the merchant was on. */
final class SupportOpenRequest extends SupportMessageRequest
{
    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            ...parent::rules(),
            'topic' => ['required', 'string', Rule::in(SupportTopic::values())],
            'page' => ['nullable', 'string', 'max:300'],
        ];
    }
}
