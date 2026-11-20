<?php

declare(strict_types=1);

namespace App\Ai\Copilot\Resources;

use App\Ai\Copilot\Contracts\CopilotResource;
use App\Ai\Copilot\Contracts\Field;
use App\Ai\Copilot\CopilotContext;
use App\Models\ShippingCompany;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;

/** «شركات الشحن» the customer chooses at checkout (fees per governorate live on each company). */
final class ShippingCompaniesResource extends CopilotResource
{
    public function key(): string
    {
        return 'shipping_companies';
    }

    public function label(): string
    {
        return 'شركات الشحن';
    }

    public function summary(): string
    {
        return 'Shipping companies: default fee, delivery days, active or not (fees per governorate are set on each company).';
    }

    public function model(): string
    {
        return ShippingCompany::class;
    }

    public function query(CopilotContext $ctx): Builder
    {
        return ShippingCompany::query()->orderBy('position');
    }

    public function fields(): array
    {
        return [
            Field::text('name')->label('الاسم')->searchable()->sortable(),
            Field::money('default_fee')->label('سعر الشحن الأساسي')->filterable()->sortable(),
            Field::int('delivery_days_min')->label('أقل مدة (أيام)'),
            Field::int('delivery_days_max')->label('أقصى مدة (أيام)'),
            Field::bool('is_active')->label('شغالة')->filterable(),
        ];
    }

    public function url(?Model $row): ?string
    {
        return '/dashboard/shipping';
    }
}
