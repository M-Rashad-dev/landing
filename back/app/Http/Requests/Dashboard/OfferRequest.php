<?php

declare(strict_types=1);

namespace App\Http\Requests\Dashboard;

use App\Enums\OfferType;
use App\Http\Requests\ApiRequest;
use App\Models\Product;
use App\Rules\CairoDateTime;
use App\Rules\TenantExists;
use App\Support\CairoTime;
use App\Support\Money;
use Illuminate\Validation\Validator;

/** Section 7.2 offer rules. */
final class OfferRequest extends ApiRequest
{
    protected function prepareForValidation(): void
    {
        $merge = [];
        foreach (['name', 'badge_text'] as $key) {
            if (is_string($this->input($key))) {
                $value = trim(strip_tags($this->input($key)));
                $merge[$key] = $value === '' ? null : $value;
            }
        }
        foreach (['starts_at', 'ends_at', 'value', 'bundle_quantity', 'bundle_price'] as $key) {
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
        $type = $this->input('type');

        return [
            'name' => ['required', 'string', 'max:100'],
            'type' => ['required', 'string', 'in:'.implode(',', OfferType::values())],
            'value' => match ($type) {
                OfferType::Percentage->value => ['required', 'integer', 'between:1,95'],
                OfferType::Fixed->value => ['required', ...$money, 'gt:0', 'max:9999999.99'],
                default => ['nullable'],
            },
            'bundle_quantity' => $type === OfferType::Bundle->value ? ['required', 'integer', 'between:2,20'] : ['nullable'],
            'bundle_price' => $type === OfferType::Bundle->value ? ['required', ...$money, 'gt:0', 'max:9999999.99'] : ['nullable'],
            'starts_at' => ['nullable', new CairoDateTime],
            'ends_at' => ['nullable', new CairoDateTime],
            'is_active' => ['sometimes', 'boolean'],
            'badge_text' => ['nullable', 'string', 'max:40'],
            'priority' => ['sometimes', 'integer', 'between:0,1000'],
            'product_ids' => ['required', 'array', 'min:1', 'max:100'],
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

            $products = Product::query()->whereIn('id', (array) $this->input('product_ids'))->get(['id', 'name', 'price']);

            if ($this->input('type') === OfferType::Fixed->value) {
                $value = Money::toCents((string) $this->input('value'));
                $cheapest = $products->min(fn (Product $p) => $p->priceCents());
                if ($cheapest !== null && $value >= $cheapest) {
                    $validator->errors()->add('value', __('promotions.fixed_below_price'));
                }
            }

            if ($this->input('type') === OfferType::Bundle->value) {
                $bundlePrice = Money::toCents((string) $this->input('bundle_price'));
                $quantity = (int) $this->input('bundle_quantity');
                foreach ($products as $product) {
                    if ($bundlePrice >= $product->priceCents() * $quantity) {
                        $validator->errors()->add('bundle_price', __('promotions.bundle_not_profitable', ['product' => $product->name]));

                        break;
                    }
                }
            }
        });
    }

    /** @return array<string, mixed> */
    public function offerData(): array
    {
        $type = OfferType::from((string) $this->validated('type'));

        return [
            'name' => $this->validated('name'),
            'type' => $type,
            'value' => match ($type) {
                OfferType::Percentage => Money::toDecimal(((int) $this->validated('value')) * 100),
                OfferType::Fixed => Money::toDecimal(Money::toCents((string) $this->validated('value'))),
                OfferType::Bundle => null,
            },
            'bundle_quantity' => $type === OfferType::Bundle ? (int) $this->validated('bundle_quantity') : null,
            'bundle_price' => $type === OfferType::Bundle ? Money::toDecimal(Money::toCents((string) $this->validated('bundle_price'))) : null,
            'starts_at' => CairoTime::parse($this->validated('starts_at')),
            'ends_at' => CairoTime::parse($this->validated('ends_at')),
            'is_active' => (bool) $this->validated('is_active', true),
            'badge_text' => $this->validated('badge_text'),
            'priority' => (int) $this->validated('priority', 0),
        ];
    }

    /** @return list<int> */
    public function productIds(): array
    {
        return array_values(array_map('intval', (array) $this->validated('product_ids')));
    }
}
