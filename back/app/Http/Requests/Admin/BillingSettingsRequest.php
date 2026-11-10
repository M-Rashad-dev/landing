<?php

declare(strict_types=1);

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

final class BillingSettingsRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'trial_enabled' => ['required', 'boolean'],
            'trial_days' => ['required', 'integer', 'between:1,90'],
            'trial_plan_key' => ['required', 'string', Rule::exists('plans', 'key')->where('is_archived', false)],
            'grace_hours' => ['required', 'integer', 'between:0,168'],
            'invoice_hours' => ['sometimes', 'integer', 'between:1,720'],
            'support_email' => ['sometimes', 'nullable', 'email:rfc', 'max:120'],
            'support_whatsapp' => ['sometimes', 'nullable', 'string', 'regex:/^\+?[0-9]{8,15}$/'],
        ];
    }
}
