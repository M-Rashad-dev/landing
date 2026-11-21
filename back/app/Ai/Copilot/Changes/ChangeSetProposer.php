<?php

declare(strict_types=1);

namespace App\Ai\Copilot\Changes;

use App\Ai\AiWallets;
use App\Ai\Copilot\Contracts\CopilotAction;
use App\Ai\Copilot\Contracts\CopilotResource;
use App\Ai\Copilot\Contracts\Field;
use App\Ai\Copilot\CopilotContext;
use App\Ai\Copilot\Support\CopilotToolError;
use App\Ai\Copilot\Support\CopilotValidationError;
use App\Ai\Copilot\Support\FormRequestRunner;
use App\Billing\Entitlements;
use App\Models\CopilotChangeItem;
use App\Models\CopilotChangeSet;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\ValidationException;

/**
 * Prepares a change (docs/plans/ai-copilot.md §3.6):
 * - create: new records saved at once as drafts (through the resource's request and action), waiting for «انشر»;
 * - update: the exact new value of every record computed now (ValueOps) and stored with its old value, nothing in the
 *   store changes until the merchant presses «نفّذ».
 */
final class ChangeSetProposer
{
    /** Records per create call. */
    public const MAX_CREATE = 50;

    public function __construct(private readonly Entitlements $entitlements) {}

    /**
     * @param  list<array<string, mixed>>  $items
     */
    public function create(CopilotResource $resource, array $items, bool $keepDraft, CopilotContext $ctx): CopilotChangeSet
    {
        if (! $resource->creatable()) {
            throw new CopilotToolError("New {$resource->key()} can't be created here.");
        }
        if ($items === [] || count($items) > self::MAX_CREATE || ! array_is_list($items)) {
            throw new CopilotToolError('items must be a list of 1 to '.self::MAX_CREATE.' records (more: ask for a sheet, or send batches of '.self::MAX_CREATE.').');
        }
        if ($resource->limit() !== null) {
            $this->entitlements->ensureCanAdd($resource->limit(), count($items));
        }

        // Every record is checked first: a batch is created whole or not at all.
        $requests = [];
        $errors = [];
        foreach ($items as $i => $item) {
            if (! is_array($item)) {
                $errors["items.{$i}"] = 'Each item is an object of fields.';

                continue;
            }
            try {
                $requests[$i] = FormRequestRunner::run((string) $resource->request(), [...$resource->createDefaults(), ...$item, ...$resource->draft()], $ctx->user);
            } catch (ValidationException $e) {
                $errors["items.{$i}"] = FormRequestRunner::errors($e);
            }
        }
        if ($errors !== []) {
            throw new CopilotValidationError('Nothing was created: fix these items and send the whole batch again.', $errors);
        }

        $set = DB::transaction(function () use ($resource, $requests, $keepDraft, $ctx): CopilotChangeSet {
            $rows = array_map(fn ($request) => $resource->persist($request, null), $requests);
            $set = CopilotChangeSet::query()->create([
                'chat_id' => $ctx->chat?->id,
                'message_id' => $ctx->message?->id,
                'user_id' => $ctx->user?->id,
                'kind' => CopilotChangeSet::KIND_CREATE,
                'target' => $resource->key(),
                'summary' => (string) __('ai.copilot.changes.created', ['count' => count($rows), 'label' => $resource->label()]),
                'spec' => ['count' => count($rows)],
                'status' => CopilotChangeSet::STATUS_PROPOSED,
                'keep_draft' => $keepDraft,
                'reversible' => true,
                'items_count' => count($rows),
            ]);
            foreach ($rows as $row) {
                $row->refresh();
                CopilotChangeItem::query()->create([
                    'change_set_id' => $set->id,
                    'entity_type' => $resource->key(),
                    'entity_id' => (int) $row->getKey(),
                    'label' => $resource->labelOf($row),
                    // Reject deletes a draft only while it is exactly as created.
                    'after' => ['updated_at' => $row->getAttribute('updated_at')?->utc()->format('Y-m-d H:i:s')],
                    'status' => CopilotChangeItem::PENDING,
                ]);
            }

            return $set;
        });
        $resource->afterBulk($ctx);
        $ctx->addBlock(['type' => 'change_set', 'id' => $set->id]);

        return $set;
    }

    /**
     * @param  array<string, mixed>  $selector
     * @param  array<string, mixed>  $changes  field => op
     * @return array{set: CopilotChangeSet, unchanged: int}
     */
    public function update(CopilotResource $resource, array $selector, array $changes, CopilotContext $ctx): array
    {
        if (! $resource->writable()) {
            throw new CopilotToolError("{$resource->key()} can't be changed here.");
        }
        $fields = $this->changedFields($resource, $changes);
        $this->ensureRoom();

        $ids = Selector::ids($resource, $selector, $ctx);
        if ($ids === []) {
            throw new CopilotToolError("No {$resource->key()} match: nothing to change.");
        }

        $items = [];
        $unchanged = 0;
        $keyName = $resource->query($ctx)->getModel()->getQualifiedKeyName();
        foreach (array_chunk($ids, 500) as $chunk) {
            $rows = $resource->query($ctx)->with($resource->with())->whereIn($keyName, $chunk)->get();
            foreach ($rows as $row) {
                $item = $this->item($resource, $row, $fields, $changes);
                $item === null ? $unchanged++ : $items[] = $item;
            }
        }
        $pending = array_values(array_filter($items, fn (array $i) => $i['status'] === CopilotChangeItem::PENDING));
        if ($pending === []) {
            $reasons = array_values(array_unique(array_filter(array_column($items, 'note'))));
            throw new CopilotToolError('Nothing would change'.($reasons !== [] ? ': '.implode(' / ', array_slice($reasons, 0, 3)) : ' (the values are already like that).'));
        }

        $set = DB::transaction(function () use ($resource, $selector, $changes, $fields, $items, $pending, $ctx): CopilotChangeSet {
            $set = CopilotChangeSet::query()->create([
                'chat_id' => $ctx->chat?->id,
                'message_id' => $ctx->message?->id,
                'user_id' => $ctx->user?->id,
                'kind' => CopilotChangeSet::KIND_UPDATE,
                'target' => $resource->key(),
                'summary' => mb_substr(implode('، ', array_map(fn (Field $f) => ValueOps::describe($f, $changes[$f->key]), $fields)), 0, 200)
                    .' — '.(string) __('ai.copilot.changes.records', ['count' => count($pending), 'label' => $resource->label()]),
                'spec' => ['selector' => $selector, 'changes' => $changes, 'fields' => array_map(fn (Field $f) => $f->key, $fields)],
                'status' => CopilotChangeSet::STATUS_PROPOSED,
                'reversible' => true,
                'items_count' => count($items),
                'skipped_count' => count($items) - count($pending),
                'expires_at' => now()->addHours(CopilotChangeSet::PROPOSAL_HOURS),
            ]);
            $now = now();
            foreach (array_chunk($items, 500) as $chunk) {
                // One insert per 500 records (tenant_id set here: insert() skips model events).
                CopilotChangeItem::query()->insert(array_map(fn (array $i) => [
                    'tenant_id' => $set->tenant_id,
                    'change_set_id' => $set->id,
                    'entity_type' => $resource->key(),
                    'entity_id' => $i['entity_id'],
                    'label' => $i['label'],
                    'before' => json_encode($i['before'], JSON_UNESCAPED_UNICODE),
                    'after' => json_encode($i['after'], JSON_UNESCAPED_UNICODE),
                    'status' => $i['status'],
                    'note' => $i['note'],
                    'created_at' => $now,
                    'updated_at' => $now,
                ], $chunk));
            }

            return $set;
        });
        $ctx->addBlock(['type' => 'change_set', 'id' => $set->id]);

        return ['set' => $set, 'unchanged' => $unchanged];
    }

    /**
     * An action that needs the merchant: a costly one becomes an estimate card («ابدأ»); any other a preview card
     * («نفّذ») with its items and side effects.
     *
     * @param  array<string, mixed>  $args
     */
    public function action(CopilotAction $action, array $args, CopilotContext $ctx): CopilotChangeSet
    {
        $this->ensureRoom();
        $base = ['chat_id' => $ctx->chat?->id, 'message_id' => $ctx->message?->id, 'user_id' => $ctx->user?->id, 'target' => $action->key()];

        if ($action->costly()) {
            $estimate = $action->estimate($args, $ctx);
            if ($estimate->count === 0) {
                throw new CopilotToolError('Nothing to work on: no record matches.');
            }
            $set = CopilotChangeSet::query()->create($base + [
                'kind' => CopilotChangeSet::KIND_JOB,
                'summary' => mb_substr($estimate->summary, 0, 255),
                'spec' => ['args' => $args, 'usd' => $estimate->usd, ...$estimate->spec],
                'status' => CopilotChangeSet::STATUS_ESTIMATE,
                'reversible' => true,
                'estimate_cents' => $estimate->usd > 0 ? app(AiWallets::class)->priceCents($estimate->usd) : 0,
                'items_count' => $estimate->count,
                'expires_at' => now()->addHours(CopilotChangeSet::PROPOSAL_HOURS),
            ]);
            $ctx->addBlock(['type' => 'change_set', 'id' => $set->id]);

            return $set;
        }

        $preview = $action->preview($args, $ctx);
        $pending = array_filter($preview->items, fn (array $i) => ($i['status'] ?? CopilotChangeItem::PENDING) === CopilotChangeItem::PENDING);
        if ($pending === []) {
            $reasons = array_values(array_unique(array_filter(array_column($preview->items, 'note'))));
            throw new CopilotToolError('Nothing to do'.($reasons !== [] ? ': '.implode(' / ', array_slice($reasons, 0, 3)) : '.'));
        }
        $set = DB::transaction(function () use ($action, $preview, $base, $pending): CopilotChangeSet {
            $set = CopilotChangeSet::query()->create($base + [
                'kind' => CopilotChangeSet::KIND_ACTION,
                'summary' => mb_substr($preview->summary, 0, 255),
                'spec' => $preview->spec,
                'status' => CopilotChangeSet::STATUS_PROPOSED,
                'reversible' => $action->reversible(),
                'side_effects' => $preview->sideEffects !== [] ? $preview->sideEffects : null,
                'items_count' => count($preview->items),
                'skipped_count' => count($preview->items) - count($pending),
                'expires_at' => now()->addHours(CopilotChangeSet::PROPOSAL_HOURS),
            ]);
            $this->insertItems($set, array_map(fn (array $i) => [
                'entity_type' => $i['entity_type'],
                'entity_id' => $i['entity_id'],
                'label' => $i['label'],
                'before' => $i['before'] ?? [],
                'after' => $i['after'] ?? [],
                'status' => $i['status'] ?? CopilotChangeItem::PENDING,
                'note' => isset($i['note']) ? mb_substr((string) $i['note'], 0, 200) : null,
            ], $preview->items));

            return $set;
        });
        $ctx->addBlock(['type' => 'change_set', 'id' => $set->id]);

        return $set;
    }

    /**
     * Saves a costly job's result as a normal update of its resource, waiting for «نفّذ».
     */
    public function fromJob(CopilotChangeSet $set, JobResult $result): CopilotChangeSet
    {
        $pending = array_filter($result->items, fn (array $i) => ($i['status'] ?? CopilotChangeItem::PENDING) === CopilotChangeItem::PENDING);
        DB::transaction(function () use ($set, $result, $pending): void {
            $this->insertItems($set, array_map(fn (array $i) => [
                'entity_type' => $result->target,
                'entity_id' => $i['entity_id'],
                'label' => $i['label'],
                'before' => $i['before'],
                'after' => $i['after'],
                'status' => $i['status'] ?? CopilotChangeItem::PENDING,
                'note' => isset($i['note']) ? mb_substr((string) $i['note'], 0, 200) : null,
            ], $result->items));
            $set->forceFill([
                'kind' => CopilotChangeSet::KIND_UPDATE,
                'target' => $result->target,
                'summary' => mb_substr($result->summary, 0, 255),
                'status' => $pending === [] ? CopilotChangeSet::STATUS_FAILED : CopilotChangeSet::STATUS_PROPOSED,
                'items_count' => count($result->items),
                'skipped_count' => count($result->items) - count($pending),
                'expires_at' => now()->addHours(CopilotChangeSet::PROPOSAL_HOURS),
                // Nothing to review: say why (the items' own reasons), never a bare «nothing came out».
                'error' => $pending === [] ? mb_substr(implode(' / ', array_unique(array_filter(array_map(fn (array $i) => trim((string) ($i['note'] ?? '')), $result->items)))) ?: (string) __('ai.copilot.changes.job_empty'), 0, 300) : null,
            ])->save();
        });

        return $set->refresh();
    }

    private function ensureRoom(): void
    {
        $open = CopilotChangeSet::query()->whereIn('status', [CopilotChangeSet::STATUS_PROPOSED, CopilotChangeSet::STATUS_ESTIMATE])
            ->whereIn('kind', [CopilotChangeSet::KIND_UPDATE, CopilotChangeSet::KIND_ACTION, CopilotChangeSet::KIND_JOB])->count();
        if ($open >= CopilotChangeSet::MAX_OPEN) {
            throw new CopilotToolError((string) __('ai.copilot.changes.too_many_open'));
        }
    }

    /** @param list<array{entity_type: string, entity_id: int|null, label: string, before: array<string, mixed>, after: array<string, mixed>, status: string, note: string|null}> $items */
    private function insertItems(CopilotChangeSet $set, array $items): void
    {
        $now = now();
        foreach (array_chunk($items, 500) as $chunk) {
            // One insert per 500 records (tenant_id set here: insert() skips model events).
            CopilotChangeItem::query()->insert(array_map(fn (array $i) => [
                'tenant_id' => $set->tenant_id,
                'change_set_id' => $set->id,
                'entity_type' => $i['entity_type'],
                'entity_id' => $i['entity_id'],
                'label' => mb_substr($i['label'], 0, 160),
                'before' => json_encode($i['before'], JSON_UNESCAPED_UNICODE),
                'after' => json_encode($i['after'], JSON_UNESCAPED_UNICODE),
                'status' => $i['status'],
                'note' => $i['note'],
                'created_at' => $now,
                'updated_at' => $now,
            ], $chunk));
        }
    }

    /**
     * @param  array<string, mixed>  $changes
     * @return list<Field>
     */
    private function changedFields(CopilotResource $resource, array $changes): array
    {
        if ($changes === [] || array_is_list($changes)) {
            throw new CopilotToolError('changes is an object {field: op}.');
        }
        $map = $resource->fieldMap();
        $fields = [];
        foreach ($changes as $key => $op) {
            $field = $map[$key] ?? null;
            if ($field === null || ! $field->editable) {
                $editable = array_keys(array_filter($map, fn (Field $f) => $f->editable));
                throw new CopilotToolError("«{$key}» can't be changed on {$resource->key()}. Editable: ".implode(', ', $editable).'.');
            }
            ValueOps::check($field, $op);
            $fields[] = $field;
        }

        return $fields;
    }

    /**
     * One record's change: null when nothing would change; skipped_invalid with the reason when the new values break
     * a rule (the merchant sees why).
     *
     * @param  list<Field>  $fields
     * @param  array<string, mixed>  $changes
     * @return array{entity_id: int, label: string, before: array<string, mixed>, after: array<string, mixed>, status: string, note: string|null}|null
     */
    private function item(CopilotResource $resource, Model $row, array $fields, array $changes): ?array
    {
        $before = [];
        $after = [];
        foreach ($fields as $field) {
            $current = $resource->raw($row, $field);
            $next = ValueOps::apply($field, $current, $changes[$field->key]);
            if (! ValueOps::same($field, $current, $next)) {
                $before[$field->key] = $current;
                $after[$field->key] = $next;
            }
        }
        if ($after === []) {
            return null;
        }

        $note = null;
        foreach ($fields as $field) {
            if ($field->rules !== [] && array_key_exists($field->key, $after)) {
                $check = Validator::make([$field->key => $after[$field->key]], [$field->key => $field->rules], [], [$field->key => $field->label]);
                if ($check->fails()) {
                    $note = (string) $check->errors()->first();
                    break;
                }
            }
        }
        $note ??= $resource->validateRow($after, $row);

        return [
            'entity_id' => (int) $row->getKey(),
            'label' => $resource->labelOf($row),
            'before' => $before,
            'after' => $after,
            'status' => $note === null ? CopilotChangeItem::PENDING : CopilotChangeItem::SKIPPED_INVALID,
            'note' => $note === null ? null : mb_substr($note, 0, 200),
        ];
    }
}
