<?php

declare(strict_types=1);

namespace App\Http\Requests\Admin;

use App\Enums\AdminAlert;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

final class AdminAlertsRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'email' => ['present', 'nullable', 'email:rfc', 'max:120'],
            'events' => ['present', 'array'],
            'events.*' => ['string', 'distinct', Rule::enum(AdminAlert::class)],
        ];
    }
}
