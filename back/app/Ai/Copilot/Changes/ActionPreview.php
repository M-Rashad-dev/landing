<?php

declare(strict_types=1);

namespace App\Ai\Copilot\Changes;

/**
 * What an approval action will do, before the merchant decides: one item per touched thing (before / after for the
 * card and the stale check), its side effects in Arabic («هيتبعت 34 رسالة للعملاء») and what apply() needs (spec).
 */
final class ActionPreview
{
    /**
     * @param  list<array{entity_type: string, entity_id: int|null, label: string, before?: array<string, mixed>, after?: array<string, mixed>, note?: string|null, status?: string}>  $items
     * @param  list<array{key: string, count: int, text: string}>  $sideEffects
     * @param  array<string, mixed>  $spec
     */
    public function __construct(
        public readonly string $summary,
        public readonly array $items,
        public readonly array $sideEffects = [],
        public readonly array $spec = [],
    ) {}
}
