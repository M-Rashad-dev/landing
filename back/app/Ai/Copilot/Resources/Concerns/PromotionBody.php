<?php

declare(strict_types=1);

namespace App\Ai\Copilot\Resources\Concerns;

use BackedEnum;
use Carbon\CarbonImmutable;
use DateTimeInterface;
use Illuminate\Database\Eloquent\Model;

/**
 * The request body parts promotions share: what they apply to (with their products / categories) and dates as ISO
 * UTC, so a copilot change sends the promotion back exactly as it is, plus the change.
 */
trait PromotionBody
{
    /** @return array{applies_to: string, product_ids: list<int>, category_ids: list<int>} */
    protected static function targetBody(Model $row): array
    {
        $target = $row->getAttribute('applies_to');

        return [
            'applies_to' => $target instanceof BackedEnum ? (string) $target->value : (string) $target,
            'product_ids' => $row->relationLoaded('products') ? $row->products->pluck('id')->map(fn ($id) => (int) $id)->all() : [],
            'category_ids' => $row->relationLoaded('categories') ? $row->categories->pluck('id')->map(fn ($id) => (int) $id)->all() : [],
        ];
    }

    protected static function iso(mixed $value): ?string
    {
        return $value instanceof DateTimeInterface ? CarbonImmutable::instance($value)->utc()->format('Y-m-d\TH:i:s\Z') : null;
    }

    protected static function money(mixed $value): ?string
    {
        return $value === null ? null : (string) $value;
    }
}
