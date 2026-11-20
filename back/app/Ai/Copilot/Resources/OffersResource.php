<?php

declare(strict_types=1);

namespace App\Ai\Copilot\Resources;

use App\Actions\Promotions\SaveOffer;
use App\Ai\Copilot\Contracts\CopilotResource;
use App\Ai\Copilot\Contracts\Field;
use App\Ai\Copilot\CopilotContext;
use App\Ai\Copilot\Resources\Concerns\PromotionBody;
use App\Enums\OfferType;
use App\Enums\PlanLimit;
use App\Http\Requests\Dashboard\OfferRequest;
use App\Jobs\RevalidateTenantHosts;
use App\Models\Offer;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Foundation\Http\FormRequest;

/** «العروض» (automatic offers): created as drafts (off), changed through OfferRequest + SaveOffer. */
final class OffersResource extends CopilotResource
{
    use PromotionBody;

    public function key(): string
    {
        return 'offers';
    }

    public function label(): string
    {
        return 'العروض';
    }

    public function summary(): string
    {
        return 'Automatic offers: type (percentage 1–95 | fixed | bundle | buy_get | gift), value, start / end dates (Cairo), priority, active or not.';
    }

    public function model(): string
    {
        return Offer::class;
    }

    public function fields(): array
    {
        return [
            Field::text('name')->label('الاسم')->searchable()->sortable()->editable(),
            Field::enum('type', OfferType::class)->label('النوع')->filterable(),
            Field::money('value')->label('القيمة')->filterable()->editable(),
            Field::text('badge_text')->label('الشارة')->editable(),
            Field::int('priority')->label('الأولوية')->sortable()->editable(),
            Field::date('starts_at')->label('يبدأ')->filterable()->sortable()->editable(),
            Field::date('ends_at')->label('ينتهي')->filterable()->sortable()->editable(),
            Field::bool('is_active')->label('شغال')->filterable()->bulk(),
        ];
    }

    public function with(): array
    {
        return ['products:products.id', 'categories:categories.id'];
    }

    public function request(): ?string
    {
        return OfferRequest::class;
    }

    public function routeParameter(): string
    {
        return 'offer';
    }

    public function body(Model $row): array
    {
        return [
            'name' => $row->getAttribute('name'),
            'type' => $row->getAttribute('type')?->value,
            'value' => $this->requestValue($row, $row->getAttribute('value')),
            'bundle_quantity' => $row->getAttribute('bundle_quantity'),
            'bundle_price' => self::money($row->getAttribute('bundle_price')),
            'min_quantity' => $row->getAttribute('min_quantity'),
            'free_quantity' => $row->getAttribute('free_quantity'),
            'gift_product_id' => $row->getAttribute('gift_product_id'),
            'starts_at' => self::iso($row->getAttribute('starts_at')),
            'ends_at' => self::iso($row->getAttribute('ends_at')),
            'is_active' => (bool) $row->getAttribute('is_active'),
            'badge_text' => $row->getAttribute('badge_text'),
            'priority' => (int) $row->getAttribute('priority'),
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
        /** @var OfferRequest $validated */
        return app(SaveOffer::class)->handle($validated->offerData(), $validated->productIds(), $validated->categoryIds(), $row instanceof Offer ? $row : null);
    }

    public function draft(): array
    {
        return ['is_active' => false];
    }

    public function publish(): array
    {
        return ['is_active' => true];
    }

    /** The dashboard's own delete (the offer only; orders keep their snapshot). */
    public function remove(Model $row): void
    {
        $row->delete();
    }

    public function afterBulk(CopilotContext $ctx): void
    {
        RevalidateTenantHosts::dispatch($ctx->tenant->id)->afterCommit();
    }

    public function limit(): ?PlanLimit
    {
        return PlanLimit::Offers;
    }

    public function createFields(): array
    {
        return [
            'name' => 'required, ≤ 100',
            'type' => 'percentage | fixed | bundle | buy_get | gift',
            'value' => 'percentage: 1–95; fixed: EGP',
            'bundle_quantity' => 'bundle: 2–20',
            'bundle_price' => 'bundle: EGP',
            'min_quantity' => 'buy_get: units paid',
            'free_quantity' => 'buy_get: units free',
            'gift_product_id' => 'gift: product id',
            'badge_text' => '≤ 40',
            'starts_at' => 'Cairo «YYYY-MM-DDTHH:MM»',
            'ends_at' => 'Cairo «YYYY-MM-DDTHH:MM»',
            'applies_to' => 'all | products | categories (with product_ids / category_ids)',
        ];
    }

    public function url(?Model $row): ?string
    {
        return '/dashboard/marketing/offers';
    }

    private function requestValue(Model $row, mixed $value): mixed
    {
        return $row->getAttribute('type') === OfferType::Percentage && $value !== null ? (int) round((float) $value) : self::money($value);
    }
}
