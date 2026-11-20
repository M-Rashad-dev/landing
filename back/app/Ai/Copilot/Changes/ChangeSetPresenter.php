<?php

declare(strict_types=1);

namespace App\Ai\Copilot\Changes;

use App\Ai\Copilot\Contracts\CopilotResource;
use App\Ai\Copilot\Contracts\Field;
use App\Ai\Copilot\CopilotCatalog;
use App\Ai\Copilot\CopilotContext;
use App\Models\CopilotChangeItem;
use App\Models\CopilotChangeSet;
use App\Models\Media;
use App\Support\CairoTime;
use App\Support\Money;
use Carbon\CarbonImmutable;

/** A change as the chat card and the history page show it: counts, the changed columns, the records page by page. */
final class ChangeSetPresenter
{
    public const SAMPLE = 10;

    public const PAGE = 50;

    public function __construct(private readonly CopilotCatalog $catalog, private readonly ChangeSetApplier $applier) {}

    /** @return array<string, mixed> */
    public function set(CopilotChangeSet $set, CopilotContext $ctx): array
    {
        $resource = $this->catalog->resource($set->target, $ctx);
        $action = $resource === null ? $this->catalog->action($set->target, $ctx) : null;
        $counts = CopilotChangeItem::query()->where('change_set_id', $set->id)->selectRaw('status, count(*) as n')->groupBy('status')->pluck('n', 'status')->map(fn ($n) => (int) $n)->all();
        $page = $this->items($set, $ctx, null, 1, self::SAMPLE);
        $waiting = in_array($set->status, [CopilotChangeSet::STATUS_PROPOSED, CopilotChangeSet::STATUS_ESTIMATE], true);
        $open = $waiting && ($set->expires_at === null || $set->expires_at->isFuture());

        return [
            'id' => $set->id,
            'kind' => $set->kind,
            'target' => $set->target,
            'target_label' => $resource?->label() ?? $action?->label() ?? $set->target,
            'summary' => $set->summary,
            'status' => $open || ! $waiting ? $set->status : CopilotChangeSet::STATUS_EXPIRED,
            'keep_draft' => $set->keep_draft,
            'reversible' => $set->reversible,
            'items_count' => $set->items_count,
            'applied_count' => $set->applied_count,
            'skipped_count' => $set->skipped_count,
            'failed_count' => $set->failed_count,
            'counts' => $counts,
            'columns' => $page['columns'],
            'items' => $page['items'],
            'has_more_items' => $page['total'] > self::SAMPLE,
            'link' => $resource?->url(null),
            'estimate' => match (true) {
                $set->estimate_cents === null => null,
                $set->estimate_cents === 0 => (string) __('ai.copilot.changes.free'),
                default => (string) __('ai.copilot.changes.estimate', ['amount' => Money::toDecimal($set->estimate_cents)]),
            },
            'side_effects' => array_values(array_map(fn (array $e) => (string) $e['text'], (array) ($set->side_effects ?? []))),
            'extra' => $action?->card($set),
            'error' => $set->error,
            'can' => ['accept' => $open, 'reject' => $open, 'revert' => $this->applier->canRevert($set)],
            'expires_at' => $set->expires_at?->toIso8601ZuluString(),
            'applied_at' => $set->applied_at?->toIso8601ZuluString(),
            'reverted_at' => $set->reverted_at?->toIso8601ZuluString(),
            'created_at' => $set->created_at?->toIso8601ZuluString(),
        ];
    }

    /** @return array{columns: list<array{key: string, label: string, kind: string}>, items: list<array<string, mixed>>, total: int, page: int, last_page: int} */
    public function items(CopilotChangeSet $set, CopilotContext $ctx, ?string $status, int $page, int $perPage = self::PAGE): array
    {
        $resource = $this->catalog->resource($set->target, $ctx);
        $action = $resource === null ? $this->catalog->action($set->target, $ctx) : null;
        $map = $resource?->fieldMap() ?? [];
        $actionColumns = $action?->columns() ?? [];
        // An action column with labels (e.g. order statuses) reads like an enum field.
        foreach ($actionColumns as $key => $column) {
            if (isset($column[2]) && is_array($column[2]) && ! isset($map[$key])) {
                $map[$key] = Field::enum((string) $key, array_map('strval', array_keys($column[2])))->label($column[0])->labels($column[2]);
            }
        }
        $query = CopilotChangeItem::query()->where('change_set_id', $set->id)->when($status !== null, fn ($q) => $q->where('status', $status))->orderBy('id');
        $total = (clone $query)->count();
        $items = $query->forPage(max(1, $page), $perPage)->get();

        $keys = array_values(array_unique(array_merge(
            (array) ($set->spec['fields'] ?? []),
            ...$items->map(fn (CopilotChangeItem $i) => array_keys(array_diff_key((array) ($i->after ?? []), ['updated_at' => true])))->all(),
        )));
        $columns = array_values(array_map(fn (string $k) => [
            'key' => $k,
            'label' => ($map[$k] ?? null)?->label ?? ($actionColumns[$k][0] ?? $k),
            'kind' => ($map[$k] ?? null) !== null ? ($map[$k]->media ? 'images' : $map[$k]->type) : ($actionColumns[$k][1] ?? 'text'),
        ], $keys));

        return [
            'columns' => $columns,
            'items' => $items->map(fn (CopilotChangeItem $i) => [
                'id' => $i->id,
                'entity_id' => $i->entity_id,
                'label' => $i->label,
                'url' => $i->entity_id !== null && ($owner = $resource ?? $this->catalog->resource($i->entity_type, $ctx)) !== null ? $this->url($owner, (int) $i->entity_id, $ctx) : null,
                'before' => $this->display((array) ($i->before ?? []), $keys, $map),
                'after' => $this->display((array) ($i->after ?? []), $keys, $map),
                'status' => $i->status,
                'note' => $i->note,
            ])->all(),
            'total' => $total,
            'page' => max(1, $page),
            'last_page' => max(1, (int) ceil($total / $perPage)),
        ];
    }

    /**
     * What the model learns about a proposal it made.
     *
     * @return array<string, mixed>
     */
    public function forModel(CopilotChangeSet $set, int $unchanged = 0): array
    {
        $items = CopilotChangeItem::query()->where('change_set_id', $set->id)->orderBy('id')->limit(self::SAMPLE)->get();
        $reasons = CopilotChangeItem::query()->where('change_set_id', $set->id)->where('status', CopilotChangeItem::SKIPPED_INVALID)
            ->distinct()->limit(5)->pluck('note')->filter()->values()->all();

        if ($set->kind === CopilotChangeSet::KIND_JOB) {
            return [
                'change_set_id' => $set->id,
                'summary' => $set->summary,
                'records' => $set->items_count,
                'estimated_cost_egp' => $set->estimate_cents === null ? null : Money::toDecimal($set->estimate_cents),
                'note' => 'Nothing has run and nothing is charged yet. A card shows the estimated cost; the work starts only when the merchant presses «ابدأ», then a preview comes to approve.',
            ];
        }

        return array_filter([
            'change_set_id' => $set->id,
            'kind' => $set->kind,
            'summary' => $set->summary,
            'records' => $set->items_count - $set->skipped_count,
            'skipped_invalid' => $set->skipped_count ?: null,
            'skip_reasons' => $reasons ?: null,
            'unchanged_already' => $unchanged ?: null,
            'sample' => $items->map(fn (CopilotChangeItem $i) => array_filter(['label' => $i->label, 'before' => $i->before, 'after' => $set->kind === CopilotChangeSet::KIND_CREATE ? null : $i->after, 'skipped' => $i->note]))->all(),
            'side_effects' => array_values(array_map(fn (array $e) => (string) $e['text'], (array) ($set->side_effects ?? []))) ?: null,
            'reversible' => $set->reversible ? null : false,
            'note' => $set->kind === CopilotChangeSet::KIND_CREATE
                ? 'Created now as drafts (not visible to customers). A card under your reply lets the merchant publish them («انشر») or delete them («امسح»).'
                : 'Nothing has changed yet. A card under your reply shows the preview; the change happens only when the merchant presses «نفّذ».',
        ], fn ($v) => $v !== null);
    }

    /**
     * @param  array<string, mixed>  $values
     * @param  list<string>  $keys
     * @param  array<string, Field>  $map
     * @return array<string, string|null>
     */
    private function display(array $values, array $keys, array $map): array
    {
        $out = [];
        foreach ($keys as $key) {
            if (! array_key_exists($key, $values)) {
                continue;
            }
            $value = $values[$key];
            $field = $map[$key] ?? null;
            $out[$key] = match (true) {
                $value === null || $value === '' => null,
                $field?->type === 'bool' => $value ? (string) __('ai.copilot.yes') : (string) __('ai.copilot.no'),
                $field?->type === 'enum' => $field->labels[(string) $value] ?? (string) $value,
                $field?->type === 'date' => CarbonImmutable::parse((string) $value, 'UTC')->setTimezone(CairoTime::ZONE)->format('Y-m-d H:i'),
                $field?->media === true => implode('|', self::mediaUrls(array_map('intval', (array) $value))),
                $field?->type === 'ids' && $field->names !== null => implode('، ', ($field->names)(array_map('intval', (array) $value))),
                is_array($value) && ! array_is_list($value) => mb_substr(implode('، ', array_map(fn ($k, $v) => $k.': '.(is_scalar($v) ? (string) $v : ''), array_keys($value), $value)), 0, 600),
                is_array($value) => implode('، ', array_map(fn ($v) => is_scalar($v) ? (string) $v : '', $value)),
                default => mb_substr((string) $value, 0, 300),
            };
        }

        return $out;
    }

    /**
     * Thumbnails of media ids (this store's only), in the given order.
     *
     * @param  list<int>  $ids
     * @return list<string>
     */
    private static function mediaUrls(array $ids): array
    {
        $media = Media::query()->whereIn('id', $ids)->get()->keyBy('id');

        return array_values(array_filter(array_map(fn (int $id) => $media->get($id)?->urls()['thumb'] ?? null, $ids)));
    }

    private function url(CopilotResource $resource, int $id, CopilotContext $ctx): ?string
    {
        $model = $resource->query($ctx)->getModel()->newInstance();
        $model->setAttribute($model->getKeyName(), $id);

        return $resource->url($model);
    }
}
