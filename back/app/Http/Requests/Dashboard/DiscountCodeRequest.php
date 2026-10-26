<?php

declare(strict_types=1);

namespace App\Http\Requests\Dashboard;

use App\Enums\DiscountType;
use App\Http\Requests\ApiRequest;
use App\Models\DiscountCode;
use App\Rules\CairoDateTime;
use App\Rules\TenantExists;
use App\Rules\TenantUnique;
use App\Support\CairoTime;
use App\Support\Money;
use Illuminate\Validation\Validator;

/** Section 7.2 discount code rules. */
final class DiscountCodeRequest extends ApiRequest
{
    protected function prepareForValidation(): void
    {
        $merge = [];
        if (is_string($this->input('code'))) {
            $merge['code'] = DiscountCode::normalizeCode($this->input('code'));
        }
        foreach (['starts_at', 'ends_at', 'max_discount', 'min_order_total', 'usage_limit', 'usage_limit_per_phone'] as $key) {
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
            'value' => $this->input('type') === DiscountType::Percentage->value
                ? ['required', 'integer', 'between:1,100']
                : ['required', ...$money, 'gt:0', 'max:9999999.99'],
            'max_discount' => ['nullable', ...$money, 'gt:0', 'max:9999999.99'],
            'min_order_total' => ['nullable', ...$money, 'min:0', 'max:9999999.99'],
            'starts_at' => ['nullable', new CairoDateTime],
            'ends_at' => ['nullable', new CairoDateTime],
            'usage_limit' => ['nullable', 'integer', 'min:1', 'max:1000000'],
            'usage_limit_per_phone' => ['nullable', 'integer', 'min:1', 'max:1000'],
            'stackable_with_offers' => ['sometimes', 'boolean'],
            'is_active' => ['sometimes', 'boolean'],
            'product_ids' => ['sometimes', 'array', 'max:100'],
            'product_ids.*' => ['integer', 'distinct', TenantExists::table('products')->ignoreTrashed()],
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
            'value' => $type === DiscountType::Percentage
                ? Money::toDecimal(((int) $this->validated('value')) * 100)
                : Money::toDecimal(Money::toCents((string) $this->validated('value'))),
            'max_discount' => $type === DiscountType::Percentage ? $cents('max_discount') : null,
            'min_order_total' => $cents('min_order_total'),
            'starts_at' => CairoTime::parse($this->validated('starts_at')),
            'ends_at' => CairoTime::parse($this->validated('ends_at')),
            'usage_limit' => $this->validated('usage_limit'),
            'usage_limit_per_phone' => $this->validated('usage_limit_per_phone'),
            'stackable_with_offers' => (bool) $this->validated('stackable_with_offers', true),
            'is_active' => (bool) $this->validated('is_active', true),
        ];
    }

    /** @return list<int> */
    public function productIds(): array
    {
        return array_values(array_map('intval', (array) $this->validated('product_ids', [])));
    }
}
