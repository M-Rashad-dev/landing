<?php

declare(strict_types=1);

namespace App\Http\Requests\Admin;

use App\Enums\PlanFeature;
use App\Enums\PlanLimit;
use App\Rules\CairoDateTime;
use Illuminate\Foundation\Http\FormRequest;

/** One store's exception for one feature (on/off) or limit (number, null = unlimited). */
final class EntitlementOverrideRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function isFeature(): bool
    {
        return PlanFeature::tryFrom((string) $this->route('entitlement')) !== null;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        $entitlement = (string) $this->route('entitlement');
        abort_if(PlanFeature::tryFrom($entitlement) === null && PlanLimit::tryFrom($entitlement) === null, 404);

        return [
            'value' => $this->isFeature() ? ['required', 'boolean'] : ['present', 'nullable', 'integer', 'between:0,1000000'],
            'reason' => ['required', 'string', 'min:3', 'max:300'],
            'expires_at' => ['nullable', new CairoDateTime],
        ];
    }
}
