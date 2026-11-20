<?php

declare(strict_types=1);

namespace App\Ai\Copilot\Resources;

use App\Ai\Copilot\Contracts\CopilotResource;
use App\Ai\Copilot\Contracts\Field;
use App\Ai\Copilot\CopilotContext;
use App\Enums\PlanFeature;
use App\Models\Upsell;
use Illuminate\Database\Eloquent\Model;

/** «عروض ما بعد الطلب» (upsells shown after an order), on plans that have them. */
final class UpsellsResource extends CopilotResource
{
    public function key(): string
    {
        return 'upsells';
    }

    public function label(): string
    {
        return 'عروض ما بعد الطلب';
    }

    public function summary(): string
    {
        return 'Upsells offered right after an order: the product that triggers it, the offered product and its price, active or not.';
    }

    public function available(CopilotContext $ctx): bool
    {
        return $ctx->allows(PlanFeature::Upsells);
    }

    public function model(): string
    {
        return Upsell::class;
    }

    public function fields(): array
    {
        return [
            Field::text('name')->label('الاسم')->searchable()->sortable(),
            Field::text('trigger_product')->label('بعد شراء')->using(fn (Model $u) => $u->relationLoaded('triggerProduct') ? $u->triggerProduct?->name : null),
            Field::text('offer_product')->label('المنتج المعروض')->using(fn (Model $u) => $u->relationLoaded('offerProduct') ? $u->offerProduct?->name : null),
            Field::money('price')->label('سعر العرض')->filterable(),
            Field::text('headline')->label('العنوان'),
            Field::int('priority')->label('الأولوية')->sortable(),
            Field::bool('is_active')->label('شغال')->filterable(),
        ];
    }

    public function with(): array
    {
        return ['triggerProduct:id,name', 'offerProduct:id,name'];
    }

    public function url(?Model $row): ?string
    {
        return '/dashboard/marketing/upsells';
    }
}
