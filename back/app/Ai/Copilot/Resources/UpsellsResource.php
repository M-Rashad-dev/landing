<?php

declare(strict_types=1);

namespace App\Ai\Copilot\Resources;

use App\Ai\Copilot\Contracts\CopilotResource;
use App\Ai\Copilot\Contracts\Field;
use App\Ai\Copilot\CopilotContext;
use App\Enums\PlanFeature;
use App\Http\Requests\Dashboard\UpsellRequest;
use App\Models\Upsell;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Foundation\Http\FormRequest;

/** «عروض ما بعد الطلب» (upsells shown after an order), on plans that have them; saved through UpsellRequest. */
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
        return 'Upsells offered right after an order: the product that triggers it (or any), the offered product (no required options) and its price, headline, active or not.';
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
            Field::text('name')->label('الاسم')->searchable()->sortable()->editable(),
            Field::text('trigger_product')->label('بعد شراء')->using(fn (Model $u) => $u->relationLoaded('triggerProduct') ? $u->triggerProduct?->name : null),
            Field::text('offer_product')->label('المنتج المعروض')->using(fn (Model $u) => $u->relationLoaded('offerProduct') ? $u->offerProduct?->name : null),
            Field::money('price')->label('سعر العرض')->filterable()->editable(),
            Field::text('headline')->label('العنوان')->editable(),
            Field::int('priority')->label('الأولوية')->sortable()->editable(),
            Field::bool('is_active')->label('شغال')->filterable()->bulk(),
        ];
    }

    public function with(): array
    {
        return ['triggerProduct:id,name', 'offerProduct:id,name'];
    }

    public function request(): ?string
    {
        return UpsellRequest::class;
    }

    public function routeParameter(): string
    {
        return 'upsell';
    }

    public function body(Model $row): array
    {
        return [
            'name' => $row->getAttribute('name'),
            'trigger_product_id' => $row->getAttribute('trigger_product_id'),
            'offer_product_id' => $row->getAttribute('offer_product_id'),
            'price' => (string) $row->getAttribute('price'),
            'headline' => $row->getAttribute('headline'),
            'description' => $row->getAttribute('description'),
            'is_active' => (bool) $row->getAttribute('is_active'),
            'priority' => (int) $row->getAttribute('priority'),
        ];
    }

    public function persist(FormRequest $validated, ?Model $row): Model
    {
        /** @var UpsellRequest $validated */
        if ($row instanceof Upsell) {
            $row->update($validated->upsellData());

            return $row;
        }

        return Upsell::query()->create($validated->upsellData());
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
        $row->delete();
    }

    public function createFields(): array
    {
        return [
            'name' => 'required, 2–120',
            'offer_product_id' => 'required, a product without required options',
            'trigger_product_id' => 'optional (null = after any order)',
            'price' => 'required, EGP',
            'headline' => 'required, 2–150',
            'description' => '≤ 300',
            'priority' => '0–1000',
        ];
    }

    public function url(?Model $row): ?string
    {
        return '/dashboard/marketing/upsells';
    }
}
