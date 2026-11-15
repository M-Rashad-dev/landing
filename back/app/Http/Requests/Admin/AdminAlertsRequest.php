<?php

declare(strict_types=1);

namespace App\Http\Requests\Admin;

use App\Enums\AdminAlert;
use App\Enums\NotifyChannel;
use App\Rules\EgyptPhone;
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
            'channel' => ['required', Rule::enum(NotifyChannel::class)],
            'phone' => ['present', 'nullable', 'string', 'max:30', new EgyptPhone],
            'email' => ['present', 'nullable', 'email:rfc', 'max:120'],
            'events' => ['present', 'array'],
            'events.*' => ['string', 'distinct', Rule::enum(AdminAlert::class)],
        ];
    }
}
