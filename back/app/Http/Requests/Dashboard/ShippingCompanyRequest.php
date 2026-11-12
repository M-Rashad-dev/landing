<?php

declare(strict_types=1);

namespace App\Http\Requests\Dashboard;

use App\Http\Requests\ApiRequest;
use App\Rules\TenantExists;
use App\Support\Money;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

/** A shipping company: name, logo, delivery time, default fee and the governorates that differ. */
final class ShippingCompanyRequest extends ApiRequest
{
    protected function prepareForValidation(): void
    {
        $merge = [];
        if (is_string($this->input('name'))) {
            $merge['name'] = trim(strip_tags($this->input('name')));
        }
        foreach (['media_id', 'delivery_days_min', 'delivery_days_max'] as $key) {
            if ($this->input($key) === '') {
                $merge[$key] = null;
            }
        }
        $this->merge($merge);
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        $governorates = (array) config('landing.governorates');

        return [
            'name' => ['required', 'string', 'max:60'],
            'media_id' => ['nullable', 'integer', TenantExists::table('media')],
            'delivery_days_min' => ['nullable', 'integer', 'between:0,60'],
            'delivery_days_max' => ['nullable', 'integer', 'between:0,60'],
            'default_fee' => ['required', 'numeric', 'decimal:0,2', 'min:0', 'max:100000'],
            'is_active' => ['sometimes', 'boolean'],
            'rates' => ['present', 'array', 'max:'.count($governorates)],
            'rates.*.governorate' => ['required', 'string', 'distinct', Rule::in($governorates)],
            'rates.*.fee' => ['nullable', 'numeric', 'decimal:0,2', 'min:0', 'max:100000'],
            'rates.*.is_available' => ['required', 'boolean'],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator): void {
            $min = $this->input('delivery_days_min');
            $max = $this->input('delivery_days_max');
            if ($validator->errors()->isEmpty() && $min !== null && $max !== null && (int) $max < (int) $min) {
                $validator->errors()->add('delivery_days_max', __('shipping.days_order'));
            }
        });
    }

    /** @return array<string, mixed> */
    public function companyData(): array
    {
        return [
            'name' => $this->validated('name'),
            'media_id' => $this->validated('media_id'),
            'delivery_days_min' => $this->validated('delivery_days_min'),
            'delivery_days_max' => $this->validated('delivery_days_max'),
            'default_fee' => Money::toDecimal(Money::toCents((string) $this->validated('default_fee'))),
            'is_active' => (bool) $this->validated('is_active', true),
        ];
    }

    /**
     * Only governorates that differ from the default (another fee, or not served).
     *
     * @return list<array{governorate: string, fee: string|null, is_available: bool}>
     */
    public function rates(): array
    {
        $out = [];
        foreach ((array) $this->validated('rates') as $rate) {
            $fee = $rate['fee'] === null ? null : Money::toDecimal(Money::toCents((string) $rate['fee']));
            $available = (bool) $rate['is_available'];
            if ($fee === null && $available) {
                continue;
            }
            $out[] = ['governorate' => (string) $rate['governorate'], 'fee' => $available ? $fee : null, 'is_available' => $available];
        }

        return $out;
    }
}
