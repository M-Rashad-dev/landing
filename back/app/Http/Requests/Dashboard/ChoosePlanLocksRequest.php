<?php

declare(strict_types=1);

namespace App\Http\Requests\Dashboard;

use Illuminate\Foundation\Http\FormRequest;

/** The ids that stay live inside the plan limit (the rest are locked). Ownership is checked by PlanLocks. */
final class ChoosePlanLocksRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'active_ids' => ['present', 'array', 'max:1000'],
            'active_ids.*' => ['integer', 'min:1', 'distinct'],
        ];
    }
}
