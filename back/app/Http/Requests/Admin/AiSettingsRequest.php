<?php

declare(strict_types=1);

namespace App\Http\Requests\Admin;

use App\Ai\AiSettings;
use Illuminate\Foundation\Http\FormRequest;

/** The owner's AI settings (admin «الذكاء الاصطناعي»). */
final class AiSettingsRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        $rules = [
            'features' => ['required', 'array'],
            'daily_cap_usd' => ['required', 'numeric', 'min:0', 'max:10000'],
            'usd_rate' => ['nullable', 'numeric', 'min:1', 'max:10000'],
            'margin_percent' => ['required', 'numeric', 'min:0', 'max:500'],
            'support_daily_messages' => ['required', 'integer', 'min:0', 'max:1000'],
        ];
        foreach (AiSettings::FEATURES as $feature) {
            $rules["features.{$feature}"] = ['required', 'boolean'];
        }

        return $rules;
    }
}
