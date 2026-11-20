<?php

declare(strict_types=1);

namespace App\Ai\Copilot\Resources;

use App\Ai\Copilot\Contracts\CopilotResource;
use App\Ai\Copilot\Contracts\Field;
use App\Enums\DiscountType;
use App\Models\DiscountCode;
use Illuminate\Database\Eloquent\Model;

/** «أكواد الخصم» (coupons). */
final class DiscountCodesResource extends CopilotResource
{
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
        return 'Coupon codes: type (percentage | fixed | free_shipping), value, max discount, minimum order, usage limit and times used, start / end dates, active or not.';
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
            Field::money('value')->label('القيمة')->filterable(),
            Field::money('max_discount')->label('أقصى خصم')->nullable(),
            Field::money('min_order_total')->label('أقل طلب')->nullable(),
            Field::int('usage_limit')->label('حد الاستخدام')->filterable(),
            Field::int('used_count')->label('اتستخدم')->filterable()->sortable(),
            Field::date('starts_at')->label('يبدأ')->filterable()->sortable(),
            Field::date('ends_at')->label('ينتهي')->filterable()->sortable(),
            Field::bool('is_active')->label('شغال')->filterable(),
        ];
    }

    public function labelOf(Model $row): string
    {
        return (string) $row->getAttribute('code');
    }

    public function url(?Model $row): ?string
    {
        return '/dashboard/marketing/coupons';
    }
}
