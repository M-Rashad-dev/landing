<?php

declare(strict_types=1);

namespace App\Ai\Copilot\Resources;

use App\Actions\Shipping\SaveShippingOffer;
use App\Ai\Copilot\Contracts\CopilotResource;
use App\Ai\Copilot\Contracts\Field;
use App\Ai\Copilot\CopilotContext;
use App\Ai\Copilot\Resources\Concerns\PromotionBody;
use App\Enums\ShippingBenefit;
use App\Http\Requests\Dashboard\ShippingOfferRequest;
use App\Jobs\RevalidateTenantHosts;
use App\Models\ShippingOffer;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Foundation\Http\FormRequest;

/** «عروض الشحن» (free / discounted / flat shipping): drafts (off), changed through ShippingOfferRequest + SaveShippingOffer. */
final class ShippingOffersResource extends CopilotResource
{
    use PromotionBody;

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
        return 'Shipping offers: benefit (free | discount | flat), value, minimum total / quantity, governorates, companies, start / end dates (Cairo), active or not.';
    }

    public function model(): string
    {
        return ShippingOffer::class;
    }

    public function fields(): array
    {
        return [
            Field::text('name')->label('الاسم')->searchable()->sortable()->editable(),
            Field::enum('benefit', ShippingBenefit::class)->label('الميزة')->labels(['free' => 'شحن مجاني', 'discount' => 'خصم على الشحن', 'flat' => 'سعر ثابت'])->filterable(),
            Field::money('value')->label('القيمة')->editable(),
            Field::money('min_total')->label('أقل إجمالي')->nullable()->editable(),
            Field::int('min_quantity')->label('أقل كمية')->editable(),
            Field::text('governorates')->label('المحافظات')->using(fn (Model $o) => (array) ($o->getAttribute('governorates') ?? [])),
            Field::date('starts_at')->label('يبدأ')->filterable()->editable(),
            Field::date('ends_at')->label('ينتهي')->filterable()->editable(),
            Field::bool('is_active')->label('شغال')->filterable()->bulk(),
        ];
    }

    public function with(): array
    {
        return ['products:products.id', 'categories:categories.id'];
    }

    public function request(): ?string
    {
        return ShippingOfferRequest::class;
    }

    public function routeParameter(): string
    {
        return 'shipping_offer';
    }

    public function body(Model $row): array
    {
        return [
            'name' => $row->getAttribute('name'),
            'benefit' => $row->getAttribute('benefit')?->value,
            'value' => self::money($row->getAttribute('value')),
            'min_quantity' => $row->getAttribute('min_quantity'),
            'min_total' => self::money($row->getAttribute('min_total')),
            'governorates' => $row->getAttribute('governorates'),
            'company_ids' => $row->getAttribute('company_ids'),
            'starts_at' => self::iso($row->getAttribute('starts_at')),
            'ends_at' => self::iso($row->getAttribute('ends_at')),
            'is_active' => (bool) $row->getAttribute('is_active'),
            ...self::targetBody($row),
        ];
    }

    public function persist(FormRequest $validated, ?Model $row): Model
    {
        /** @var ShippingOfferRequest $validated */
        return app(SaveShippingOffer::class)->handle($validated->offerData(), $validated->productIds(), $validated->categoryIds(), $row instanceof ShippingOffer ? $row : null);
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

    public function afterBulk(CopilotContext $ctx): void
    {
        RevalidateTenantHosts::dispatch($ctx->tenant->id)->afterCommit();
    }

    public function createFields(): array
    {
        return [
            'name' => 'required, ≤ 100',
            'benefit' => 'free | discount | flat',
            'value' => 'discount / flat: EGP',
            'min_total' => 'EGP',
            'min_quantity' => '1–1000',
            'governorates' => 'list of governorate names (empty = all)',
            'company_ids' => 'list of shipping company ids (empty = all)',
            'starts_at' => 'Cairo «YYYY-MM-DDTHH:MM»',
            'ends_at' => 'Cairo «YYYY-MM-DDTHH:MM»',
            'applies_to' => 'all | products | categories (with product_ids / category_ids)',
        ];
    }

    public function url(?Model $row): ?string
    {
        return '/dashboard/shipping';
    }
}
