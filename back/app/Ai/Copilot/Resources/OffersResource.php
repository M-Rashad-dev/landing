<?php

declare(strict_types=1);

namespace App\Ai\Copilot\Resources;

use App\Ai\Copilot\Contracts\CopilotResource;
use App\Ai\Copilot\Contracts\Field;
use App\Enums\OfferType;
use App\Models\Offer;
use Illuminate\Database\Eloquent\Model;

/** «العروض» (automatic offers: discounts, bundles, buy X get Y, gifts). */
final class OffersResource extends CopilotResource
{
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
        return 'Automatic offers: type (percentage | fixed | bundle | buy_get | gift), value, start / end dates, priority, active or not.';
    }

    public function model(): string
    {
        return Offer::class;
    }

    public function fields(): array
    {
        return [
            Field::text('name')->label('الاسم')->searchable()->sortable(),
            Field::enum('type', OfferType::class)->label('النوع')->filterable(),
            Field::money('value')->label('القيمة')->filterable(),
            Field::text('badge_text')->label('الشارة'),
            Field::int('priority')->label('الأولوية')->sortable(),
            Field::date('starts_at')->label('يبدأ')->filterable()->sortable(),
            Field::date('ends_at')->label('ينتهي')->filterable()->sortable(),
            Field::bool('is_active')->label('شغال')->filterable(),
        ];
    }

    public function url(?Model $row): ?string
    {
        return '/dashboard/marketing/offers';
    }
}
