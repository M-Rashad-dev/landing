<?php

declare(strict_types=1);

namespace App\Ai\Copilot\Changes;

use App\Ai\Copilot\Contracts\CopilotResource;
use App\Ai\Copilot\CopilotContext;
use App\Ai\Copilot\Support\CopilotToolError;
use App\Ai\Copilot\Support\RecordQuery;
use App\Models\CopilotChangeSet;

/**
 * Which records a change touches (docs/plans/ai-copilot.md §3.4): ids, filters (the same as find_records) or the page
 * the merchant is on («ده» = the open record, «دول» = the selected rows). Always inside the store; at most MAX_ITEMS.
 */
final class Selector
{
    /**
     * @param  array<string, mixed>  $selector
     * @return list<int>
     */
    public static function ids(CopilotResource $resource, array $selector, CopilotContext $ctx): array
    {
        $query = $resource->query($ctx);
        $key = $query->getModel()->getQualifiedKeyName();

        if (isset($selector['context'])) {
            $page = $ctx->page;
            $ids = match ((string) $selector['context']) {
                'entity' => isset($page['entity']['type']) && $page['entity']['type'] === $resource->key() ? [(int) $page['entity']['id']] : [],
                'selection' => isset($page['selection']['type']) && $page['selection']['type'] === $resource->key() ? array_map('intval', (array) $page['selection']['ids']) : [],
                default => throw new CopilotToolError('context is "entity" (the open record) or "selection" (the selected rows).'),
            };
            if ($ids === []) {
                throw new CopilotToolError("The merchant has no {$resource->key()} open or selected now; use ids or filters.");
            }
            $query->whereIn($key, $ids);
        } elseif (isset($selector['ids'])) {
            $ids = array_values(array_unique(array_map('intval', (array) $selector['ids'])));
            if ($ids === [] || count($ids) > CopilotChangeSet::MAX_ITEMS) {
                throw new CopilotToolError('ids must hold 1 to '.CopilotChangeSet::MAX_ITEMS.' ids.');
            }
            $query->whereIn($key, $ids);
        } elseif (isset($selector['filters']) || isset($selector['all'])) {
            $query = RecordQuery::build($resource, is_array($selector['filters'] ?? null) ? $selector['filters'] : [], null, $ctx);
        } else {
            throw new CopilotToolError('selector needs ids, filters (use {"filters": {}} for all) or context.');
        }

        $count = (clone $query)->toBase()->getCountForPagination();
        if ($count > CopilotChangeSet::MAX_ITEMS) {
            throw new CopilotToolError("That is {$count} records; one change holds at most ".CopilotChangeSet::MAX_ITEMS.'. Narrow the filters.');
        }

        return $query->pluck($key)->map(fn ($id) => (int) $id)->values()->all();
    }
}
