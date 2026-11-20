<?php

declare(strict_types=1);

namespace App\Ai\Copilot\Resources;

use App\Ai\Copilot\Contracts\CopilotResource;
use App\Ai\Copilot\Contracts\Field;
use App\Enums\ShippingBenefit;
use App\Models\ShippingOffer;
use Illuminate\Database\Eloquent\Model;

/** «عروض الشحن» (free / discounted / flat shipping above a total or quantity). */
final class ShippingOffersResource extends CopilotResource
{
    public function key(): string
    {
        return 'shipping_offers';
    }

    public function label(): string
    {
        return 'عروض الشحن';
    }

    public function summary(): string
    {
        return 'Shipping offers: benefit (free | discount | flat), value, minimum total / quantity, governorates, start / end dates, active or not.';
    }

    public function model(): string
    {
        return ShippingOffer::class;
    }

    public function fields(): array
    {
        return [
            Field::text('name')->label('الاسم')->searchable()->sortable(),
            Field::enum('benefit', ShippingBenefit::class)->label('الميزة')->labels(['free' => 'شحن مجاني', 'discount' => 'خصم على الشحن', 'flat' => 'سعر ثابت'])->filterable(),
            Field::money('value')->label('القيمة'),
            Field::money('min_total')->label('أقل إجمالي')->nullable(),
            Field::int('min_quantity')->label('أقل كمية'),
            Field::text('governorates')->label('المحافظات')->using(fn (Model $o) => (array) ($o->getAttribute('governorates') ?? [])),
            Field::date('starts_at')->label('يبدأ')->filterable(),
            Field::date('ends_at')->label('ينتهي')->filterable(),
            Field::bool('is_active')->label('شغال')->filterable(),
        ];
    }

    public function url(?Model $row): ?string
    {
        return '/dashboard/shipping';
    }
}
