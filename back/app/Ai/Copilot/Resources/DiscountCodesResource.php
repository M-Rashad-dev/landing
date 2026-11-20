<?php

declare(strict_types=1);

namespace App\Ai\Copilot\Resources;

use App\Actions\Promotions\DeleteDiscountCode;
use App\Actions\Promotions\SaveDiscountCode;
use App\Ai\Copilot\Contracts\CopilotResource;
use App\Ai\Copilot\Contracts\Field;
use App\Ai\Copilot\Resources\Concerns\PromotionBody;
use App\Enums\DiscountType;
use App\Enums\PlanLimit;
use App\Http\Requests\Dashboard\DiscountCodeRequest;
use App\Models\DiscountCode;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Foundation\Http\FormRequest;

/** «أكواد الخصم» (coupons): created as drafts (off), changed through DiscountCodeRequest + SaveDiscountCode. */
final class DiscountCodesResource extends CopilotResource
{
    use PromotionBody;

    public function key(): string
    {
        return 'discount_codes';
    }

    public function label(): string
    {
        return 'أكواد الخصم';
    }

    public function summary(): string
    {
        return 'Coupon codes: type (percentage | fixed | free_shipping), value (percentage = whole number 1–100), max discount, minimum order, usage limit and times used, start / end dates (Cairo), active or not.';
    }

    public function model(): string
    {
        return DiscountCode::class;
    }

    public function fields(): array
    {
        return [
            Field::text('code')->label('الكود')->searchable()->sortable(),
            Field::enum('type', DiscountType::class)->label('النوع')->filterable(),
            Field::money('value')->label('القيمة')->filterable()->editable(),
            Field::money('max_discount')->label('أقصى خصم')->nullable()->editable(),
            Field::money('min_order_total')->label('أقل طلب')->nullable()->editable(),
            Field::int('usage_limit')->label('حد الاستخدام')->filterable()->editable(),
            Field::int('used_count')->label('اتستخدم')->filterable()->sortable(),
            Field::date('starts_at')->label('يبدأ')->filterable()->sortable()->editable(),
            Field::date('ends_at')->label('ينتهي')->filterable()->sortable()->editable(),
            Field::bool('is_active')->label('شغال')->filterable()->bulk(),
        ];
    }

    public function with(): array
    {
        return ['products:products.id', 'categories:categories.id'];
    }

    public function labelOf(Model $row): string
    {
        return (string) $row->getAttribute('code');
    }

    public function request(): ?string
    {
        return DiscountCodeRequest::class;
    }

    public function routeParameter(): string
    {
        return 'discount_code';
    }

    public function body(Model $row): array
    {
        return [
            'code' => $row->getAttribute('code'),
            'type' => $row->getAttribute('type')?->value,
            'value' => $this->requestValue($row, $row->getAttribute('value')),
            'max_discount' => self::money($row->getAttribute('max_discount')),
            'min_order_total' => self::money($row->getAttribute('min_order_total')),
            'min_quantity' => $row->getAttribute('min_quantity'),
            'first_order_only' => (bool) $row->getAttribute('first_order_only'),
            'starts_at' => self::iso($row->getAttribute('starts_at')),
            'ends_at' => self::iso($row->getAttribute('ends_at')),
            'usage_limit' => $row->getAttribute('usage_limit'),
            'usage_limit_per_phone' => $row->getAttribute('usage_limit_per_phone'),
            'stackable_with_offers' => (bool) $row->getAttribute('stackable_with_offers'),
            'is_active' => (bool) $row->getAttribute('is_active'),
            ...self::targetBody($row),
        ];
    }

    public function requestData(array $after, Model $row): array
    {
        $after = parent::requestData($after, $row);
        if (array_key_exists('value', $after)) {
            $after['value'] = $this->requestValue($row, $after['value']);
        }

        return $after;
    }

    public function persist(FormRequest $validated, ?Model $row): Model
    {
        /** @var DiscountCodeRequest $validated */
        return app(SaveDiscountCode::class)->handle($validated->codeData(), $validated->productIds(), $validated->categoryIds(), $row instanceof DiscountCode ? $row : null);
    }

    public function draft(): array
    {
        return ['is_active' => false];
    }

    public function publish(): array
    {
        return ['is_active' => true];
    }

    public function remove(Model $row): void
    {
        app(DeleteDiscountCode::class)->handle($row instanceof DiscountCode ? $row : throw new \LogicException('Not a code.'));
    }

    public function limit(): ?PlanLimit
    {
        return PlanLimit::DiscountCodes;
    }

    public function createFields(): array
    {
        return [
            'code' => 'required, A-Z 0-9 _ - (3–30)',
            'type' => 'percentage | fixed | free_shipping',
            'value' => 'percentage: 1–100; fixed: EGP',
            'max_discount' => 'EGP, percentage only',
            'min_order_total' => 'EGP',
            'starts_at' => 'Cairo «YYYY-MM-DDTHH:MM»',
            'ends_at' => 'Cairo «YYYY-MM-DDTHH:MM»',
            'usage_limit' => 'uses in total',
            'usage_limit_per_phone' => 'uses per customer',
            'first_order_only' => 'bool',
            'applies_to' => 'all | products | categories (with product_ids / category_ids)',
        ];
    }

    public function url(?Model $row): ?string
    {
        return '/dashboard/marketing/coupons';
    }

    /** A percentage is a whole number in the request (stored as «15.00»). */
    private function requestValue(Model $row, mixed $value): mixed
    {
        return $row->getAttribute('type') === DiscountType::Percentage && $value !== null ? (int) round((float) $value) : self::money($value);
    }
}
