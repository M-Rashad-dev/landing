<?php

declare(strict_types=1);

namespace App\Http\Requests\Dashboard;

use App\Actions\Orders\PostOrderUpsell;
use App\Billing\Entitlements;
use App\Enums\PlanFeature;
use App\Http\Requests\ApiRequest;
use App\Models\Product;
use App\Rules\TenantExists;
use App\Support\Money;
use Illuminate\Validation\Validator;

/** An upsell offered right after an order (create or full update). */
final class UpsellRequest extends ApiRequest
{
    /** The plan comes first (403 before any validation message), here and for the store copilot. */
    public function authorize(): bool
    {
        app(Entitlements::class)->ensure(PlanFeature::Upsells);

        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'min:2', 'max:120'],
            'trigger_product_id' => ['nullable', 'integer', TenantExists::table('products')->ignoreTrashed()],
            'offer_product_id' => ['required', 'integer', TenantExists::table('products')->ignoreTrashed()],
            'price' => ['required', 'numeric', 'min:1', 'max:1000000'],
            'headline' => ['required', 'string', 'min:2', 'max:150'],
            'description' => ['nullable', 'string', 'max:300'],
            'is_active' => ['sometimes', 'boolean'],
            'priority' => ['sometimes', 'integer', 'min:0', 'max:1000'],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator): void {
            if ($validator->errors()->isNotEmpty()) {
                return;
            }
            $trigger = $this->input('trigger_product_id');
            if ($trigger !== null && (int) $trigger === (int) $this->input('offer_product_id')) {
                $validator->errors()->add('offer_product_id', __('orders.upsell_same_product'));

                return;
            }
            if (! PostOrderUpsell::sellable(Product::query()->with(['options', 'inputs'])->find($this->input('offer_product_id')))) {
                $validator->errors()->add('offer_product_id', __('orders.upsell_product_options'));
            }
        });
    }

    /** @return array<string, mixed> the row to save */
    public function upsellData(): array
    {
        $clean = fn (?string $value): ?string => $value === null ? null : (trim(strip_tags($value)) ?: null);

        return [
            'name' => (string) $clean((string) $this->validated('name')),
            'trigger_product_id' => $this->validated('trigger_product_id'),
            'offer_product_id' => (int) $this->validated('offer_product_id'),
            'price' => Money::toDecimal(Money::toCents((string) $this->validated('price'))),
            'headline' => (string) $clean((string) $this->validated('headline')),
            'description' => $clean($this->validated('description')),
            'is_active' => (bool) $this->validated('is_active', true),
            'priority' => (int) $this->validated('priority', 0),
        ];
    }
}
