<?php

declare(strict_types=1);

namespace App\Http\Requests\Dashboard;

use App\Enums\PromotionTarget;
use App\Enums\ShippingBenefit;
use App\Http\Requests\ApiRequest;
use App\Http\Requests\Dashboard\Concerns\TargetsProducts;
use App\Rules\CairoDateTime;
use App\Rules\TenantExists;
use App\Support\CairoTime;
use App\Support\Money;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

/** Free or cheaper delivery: benefit, conditions (pieces / total), covered products, places, time. */
final class ShippingOfferRequest extends ApiRequest
{
    use TargetsProducts;

    protected function defaultTarget(): PromotionTarget
    {
        return PromotionTarget::All;
    }

    protected function prepareForValidation(): void
    {
        $merge = [];
        if (is_string($this->input('name'))) {
            $value = trim(strip_tags($this->input('name')));
            $merge['name'] = $value === '' ? null : $value;
        }
        foreach (['value', 'min_quantity', 'min_total', 'starts_at', 'ends_at'] as $key) {
            if ($this->input($key) === '') {
                $merge[$key] = null;
            }
        }
        $this->merge($merge);
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        $money = ['numeric', 'decimal:0,2'];
        $governorates = (array) config('landing.governorates');

        return [
            'name' => ['required', 'string', 'max:100'],
            'benefit' => ['required', 'string', Rule::in(ShippingBenefit::values())],
            'value' => match ($this->input('benefit')) {
                ShippingBenefit::Discount->value => ['required', ...$money, 'gt:0', 'max:100000'],
                ShippingBenefit::Flat->value => ['required', ...$money, 'min:0', 'max:100000'],
                default => ['nullable'],
            },
            'min_quantity' => ['nullable', 'integer', 'between:1,1000'],
            'min_total' => ['nullable', ...$money, 'gt:0', 'max:9999999.99'],
            'governorates' => ['nullable', 'array', 'max:'.count($governorates)],
            'governorates.*' => ['string', 'distinct', Rule::in($governorates)],
            'company_ids' => ['nullable', 'array', 'max:50'],
            'company_ids.*' => ['integer', 'distinct', TenantExists::table('shipping_companies')],
            'starts_at' => ['nullable', new CairoDateTime],
            'ends_at' => ['nullable', new CairoDateTime],
            'is_active' => ['sometimes', 'boolean'],
            ...$this->targetRules(),
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator): void {
            if ($validator->errors()->isNotEmpty()) {
                return;
            }
            $starts = CairoTime::parse($this->input('starts_at'));
            $ends = CairoTime::parse($this->input('ends_at'));
            if ($starts !== null && $ends !== null && ! $ends->greaterThan($starts)) {
                $validator->errors()->add('ends_at', __('promotions.ends_after_starts'));
            }
        });
    }

    /** @return array<string, mixed> */
    public function offerData(): array
    {
        $benefit = ShippingBenefit::from((string) $this->validated('benefit'));
        $list = fn (string $key) => ($v = $this->validated($key)) === null || $v === [] ? null : array_values($v);

        return [
            'name' => $this->validated('name'),
            'benefit' => $benefit,
            'value' => $benefit === ShippingBenefit::Free ? null : Money::toDecimal(Money::toCents((string) $this->validated('value'))),
            'min_quantity' => $this->validated('min_quantity'),
            'min_total' => $this->validated('min_total') === null ? null : Money::toDecimal(Money::toCents((string) $this->validated('min_total'))),
            'applies_to' => $this->target(),
            'governorates' => $list('governorates'),
            'company_ids' => ($ids = $list('company_ids')) === null ? null : array_map('intval', $ids),
            'starts_at' => CairoTime::parse($this->validated('starts_at')),
            'ends_at' => CairoTime::parse($this->validated('ends_at')),
            'is_active' => (bool) $this->validated('is_active', true),
        ];
    }
}
