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
        ];
    }
}
