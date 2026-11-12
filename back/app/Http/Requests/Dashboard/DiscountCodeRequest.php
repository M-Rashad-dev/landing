<?php

declare(strict_types=1);

namespace App\Http\Requests\Dashboard;

use App\Enums\DiscountType;
use App\Enums\PromotionTarget;
use App\Http\Requests\ApiRequest;
use App\Http\Requests\Dashboard\Concerns\TargetsProducts;
use App\Models\DiscountCode;
use App\Rules\CairoDateTime;
use App\Rules\TenantUnique;
use App\Support\CairoTime;
use App\Support\Money;
use Illuminate\Validation\Validator;

/** Section 7.2 discount code rules. */
final class DiscountCodeRequest extends ApiRequest
{
    use TargetsProducts;

    protected function defaultTarget(): PromotionTarget
    {
        return PromotionTarget::All;
    }

    protected function prepareForValidation(): void
    {
        $merge = [];
        if (is_string($this->input('code'))) {
            $merge['code'] = DiscountCode::normalizeCode($this->input('code'));
        }
        foreach (['starts_at', 'ends_at', 'value', 'max_discount', 'min_order_total', 'min_quantity', 'usage_limit', 'usage_limit_per_phone'] as $key) {
            if ($this->input($key) === '') {
                $merge[$key] = null;
            }
        }
        $this->merge($merge);
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        /** @var DiscountCode|null $current */
        $current = $this->route('discount_code');
        $money = ['numeric', 'decimal:0,2'];

        return [
            'code' => ['required', 'string', 'regex:/^[A-Z0-9_-]{3,30}$/', TenantUnique::table('discount_codes', 'code')->ignore($current?->id)],
            'type' => ['required', 'string', 'in:'.implode(',', DiscountType::values())],
            'value' => match ($this->input('type')) {
                DiscountType::Percentage->value => ['required', 'integer', 'between:1,100'],
                DiscountType::FreeShipping->value => ['nullable'],
                default => ['required', ...$money, 'gt:0', 'max:9999999.99'],
            },
            'max_discount' => ['nullable', ...$money, 'gt:0', 'max:9999999.99'],
            'min_order_total' => ['nullable', ...$money, 'min:0', 'max:9999999.99'],
            'min_quantity' => ['nullable', 'integer', 'between:1,1000'],
            'first_order_only' => ['sometimes', 'boolean'],
            'starts_at' => ['nullable', new CairoDateTime],
            'ends_at' => ['nullable', new CairoDateTime],
            'usage_limit' => ['nullable', 'integer', 'min:1', 'max:1000000'],
            'usage_limit_per_phone' => ['nullable', 'integer', 'min:1', 'max:1000'],
            'stackable_with_offers' => ['sometimes', 'boolean'],
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

            /** @var DiscountCode|null $current */
            $current = $this->route('discount_code');
            if ($current !== null && $current->type->value !== $this->input('type') && $current->redemptions()->exists()) {
                $validator->errors()->add('type', __('promotions.code_type_locked'));
            }
        });
    }

    /** @return array<string, mixed> */
    public function codeData(): array
    {
        $type = DiscountType::from((string) $this->validated('type'));
        $cents = fn (?string $key) => $this->validated($key) === null ? null : Money::toDecimal(Money::toCents((string) $this->validated($key)));

        return [
            'code' => $this->validated('code'),
            'type' => $type,
            'applies_to' => $this->target(),
            'value' => match ($type) {
                DiscountType::Percentage => Money::toDecimal(((int) $this->validated('value')) * 100),
                DiscountType::Fixed => Money::toDecimal(Money::toCents((string) $this->validated('value'))),
                DiscountType::FreeShipping => '0.00',
            },
            'max_discount' => $type === DiscountType::Percentage ? $cents('max_discount') : null,
            'min_order_total' => $cents('min_order_total'),
            'min_quantity' => $this->validated('min_quantity'),
            'first_order_only' => (bool) $this->validated('first_order_only', false),
            'starts_at' => CairoTime::parse($this->validated('starts_at')),
            'ends_at' => CairoTime::parse($this->validated('ends_at')),
            'usage_limit' => $this->validated('usage_limit'),
            'usage_limit_per_phone' => $this->validated('usage_limit_per_phone'),
            'stackable_with_offers' => (bool) $this->validated('stackable_with_offers', true),
            'is_active' => (bool) $this->validated('is_active', true),
        ];
    }
}
