<?php

declare(strict_types=1);

namespace App\Ai\Copilot\Changes;

use App\Ai\Copilot\Contracts\CopilotResource;
use App\Ai\Copilot\Contracts\Field;
use App\Ai\Copilot\CopilotCatalog;
use App\Ai\Copilot\CopilotContext;
use App\Ai\Copilot\Support\FormRequestRunner;
use App\Events\CopilotUpdated;
use App\Exceptions\ApiException;
use App\Jobs\ApplyCopilotChangeSet;
use App\Models\CopilotChangeItem;
use App\Models\CopilotChangeSet;
use App\Models\CopilotChat;
use App\Models\CopilotMessage;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Throwable;

/**
 * The merchant's decisions on a change (docs/plans/ai-copilot.md §3.6). Only his buttons call this; the model can't.
 *
 * - accept: publishes drafts / applies an update in the background, writing the stored `after` values as they are;
 *   a record whose changed fields no longer equal `before` (edited since the preview) is skipped, never overwritten.
 *   Plain columns go in grouped Eloquent updates (the fast path); anything else through the resource's request and
 *   action, record by record.
 * - reject: nothing changes (drafts are deleted while untouched).
 * - revert: a new change with before / after swapped, through the same apply (so it never overwrites later edits).
 */
final class ChangeSetApplier
{
    public const CHUNK = 500;

    public function __construct(private readonly CopilotCatalog $catalog) {}

    public function accept(CopilotChangeSet $set, User $user): CopilotChangeSet
    {
        $this->ensureProposed($set);
        if ($set->expires_at !== null && $set->expires_at->isPast()) {
            $set->forceFill(['status' => CopilotChangeSet::STATUS_EXPIRED])->save();
            throw new ApiException(422, 'change_expired', (string) __('ai.copilot.changes.expired'));
        }
        // One click wins: the status moves only from «proposed».
        $moved = CopilotChangeSet::query()->whereKey($set->id)->where('status', CopilotChangeSet::STATUS_PROPOSED)
            ->update(['status' => CopilotChangeSet::STATUS_APPLYING, 'decided_at' => now(), 'decided_by' => $user->id]);
        if ($moved === 0) {
            throw ApiException::conflict('change_decided', (string) __('ai.copilot.changes.decided'));
        }
        ApplyCopilotChangeSet::dispatch($set->tenant_id, $set->id, $user->id);

        return $set->refresh();
    }

    public function reject(CopilotChangeSet $set, User $user): CopilotChangeSet
    {
        $this->ensureProposed($set);
        $ctx = $this->context($set, $user);
        if ($set->kind === CopilotChangeSet::KIND_CREATE && ($resource = $this->catalog->resource($set->target, $ctx)) !== null) {
            $this->removeDrafts($set, $resource, $ctx);
        }
        $set->forceFill(['status' => CopilotChangeSet::STATUS_REJECTED, 'decided_at' => now(), 'decided_by' => $user->id])->save();
        $this->notify($set, $user);

        return $set->refresh();
    }

    /** Whether «تراجع» is offered: an applied, reversible change, within REVERT_HOURS, with something applied. */
    public function canRevert(CopilotChangeSet $set): bool
    {
        return $set->status === CopilotChangeSet::STATUS_APPLIED && $set->reversible && $set->kind !== CopilotChangeSet::KIND_REVERT
            && $set->applied_at !== null && $set->applied_at->gt(now()->subHours(CopilotChangeSet::REVERT_HOURS)) && $set->applied_count > 0;
    }

    public function revert(CopilotChangeSet $set, User $user): CopilotChangeSet
    {
        if (! $this->canRevert($set)) {
            throw new ApiException(422, 'change_not_reversible', (string) __('ai.copilot.changes.not_reversible'));
        }
        $revert = DB::transaction(function () use ($set, $user): CopilotChangeSet {
            $locked = CopilotChangeSet::query()->whereKey($set->id)->lockForUpdate()->firstOrFail();
            if ($locked->status !== CopilotChangeSet::STATUS_APPLIED) {
                throw ApiException::conflict('change_decided', (string) __('ai.copilot.changes.decided'));
            }
            $applied = CopilotChangeItem::query()->where('change_set_id', $set->id)->where('status', CopilotChangeItem::APPLIED);
            $revert = CopilotChangeSet::query()->create([
                'chat_id' => $set->chat_id,
                'user_id' => $user->id,
                'kind' => CopilotChangeSet::KIND_REVERT,
                'target' => $set->target,
                'summary' => mb_substr((string) __('ai.copilot.changes.revert_of', ['summary' => $set->summary]), 0, 255),
                'spec' => ['reverts' => $set->id],
                'status' => CopilotChangeSet::STATUS_APPLYING,
                'reversible' => false,
                'items_count' => (clone $applied)->count(),
                'reverts_id' => $set->id,
                'decided_at' => now(),
                'decided_by' => $user->id,
            ]);
            $now = now();
            (clone $applied)->orderBy('id')->chunk(self::CHUNK, function (Collection $items) use ($revert, $now): void {
                CopilotChangeItem::query()->insert($items->map(fn (CopilotChangeItem $i) => [
                    'tenant_id' => $revert->tenant_id,
                    'change_set_id' => $revert->id,
                    'entity_type' => $i->entity_type,
                    'entity_id' => $i->entity_id,
                    'label' => $i->label,
                    'before' => json_encode($i->after, JSON_UNESCAPED_UNICODE),
                    'after' => json_encode($i->before, JSON_UNESCAPED_UNICODE),
                    'status' => CopilotChangeItem::PENDING,
                    'note' => null,
                    'created_at' => $now,
                    'updated_at' => $now,
                ])->all());
            });
            $locked->forceFill(['status' => CopilotChangeSet::STATUS_REVERTED, 'reverted_at' => now()])->save();

            return $revert;
        });
        ApplyCopilotChangeSet::dispatch($revert->tenant_id, $revert->id, $user->id);

        return $revert->refresh();
    }

    /** The job's work (inside the tenant, as the user who pressed the button). Never throws. */
    public function run(CopilotChangeSet $set, User $user): void
    {
        if ($set->status !== CopilotChangeSet::STATUS_APPLYING) {
            return;
        }
        $ctx = $this->context($set, $user);
        try {
            $resource = $this->catalog->resource($set->target, $ctx) ?? throw new \RuntimeException("Unknown target {$set->target}");
            if ($set->kind === CopilotChangeSet::KIND_CREATE) {
                $this->preparePublish($set, $resource, $ctx);
            }
            CopilotChangeItem::query()->where('change_set_id', $set->id)->where('status', CopilotChangeItem::PENDING)
                ->orderBy('id')->chunkById(self::CHUNK, function (Collection $items) use ($set, $resource, $ctx, $user): void {
                    DB::transaction(fn () => $this->applyChunk($items, $resource, $ctx));
                    $this->count($set);
                    CopilotUpdated::notify($user->id, (int) $set->chat_id, null, $set->id);
                });
            $resource->afterBulk($ctx);
            $this->count($set);
            $done = $set->applied_count > 0 || CopilotChangeItem::query()->where('change_set_id', $set->id)->where('status', CopilotChangeItem::KEPT)->exists();
            $set->forceFill(['status' => $done ? CopilotChangeSet::STATUS_APPLIED : CopilotChangeSet::STATUS_FAILED, 'applied_at' => now(), 'error' => $done ? null : (string) __('ai.copilot.changes.nothing_applied')])->save();
        } catch (Throwable $e) {
            report($e);
            $this->count($set);
            $set->forceFill(['status' => $set->applied_count > 0 ? CopilotChangeSet::STATUS_APPLIED : CopilotChangeSet::STATUS_FAILED, 'applied_at' => now(), 'error' => mb_substr((string) __('ai.copilot.changes.failed'), 0, 300)])->save();
        }
        $this->report($set, $user);
    }

    /** Publishing drafts = an update of the publish fields (so a later «تراجع» puts them back as drafts). */
    private function preparePublish(CopilotChangeSet $set, CopilotResource $resource, CopilotContext $ctx): void
    {
        $items = CopilotChangeItem::query()->where('change_set_id', $set->id)->where('status', CopilotChangeItem::PENDING)->get();
        if ($set->keep_draft) {
            CopilotChangeItem::query()->whereKey($items->modelKeys())->update(['status' => CopilotChangeItem::KEPT, 'note' => (string) __('ai.copilot.changes.kept_draft')]);

            return;
        }
        $map = $resource->fieldMap();
        $rows = $resource->query($ctx)->with($resource->with())->whereKey($items->pluck('entity_id')->all())->get()->keyBy(fn (Model $m) => (int) $m->getKey());
        foreach ($items as $item) {
            $row = $rows->get((int) $item->entity_id);
            if ($row === null) {
                continue;
            }
            $before = [];
            foreach (array_keys($resource->publish()) as $key) {
                $before[$key] = isset($map[$key]) ? $resource->raw($row, $map[$key]) : $row->getAttribute($key);
            }
            $item->forceFill(['before' => $before, 'after' => $resource->publish()])->save();
        }
    }

    /** @param Collection<int, CopilotChangeItem> $items */
    private function applyChunk(Collection $items, CopilotResource $resource, CopilotContext $ctx): void
    {
        $map = $resource->fieldMap();
        $rows = $resource->query($ctx)->with($resource->with())->whereKey($items->pluck('entity_id')->all())->get()->keyBy(fn (Model $m) => (int) $m->getKey());
        $fast = [];

        foreach ($items as $item) {
            $row = $rows->get((int) $item->entity_id);
            if ($row === null) {
                $item->forceFill(['status' => CopilotChangeItem::FAILED, 'note' => (string) __('ai.copilot.changes.gone')])->save();

                continue;
            }
            $after = (array) $item->after;
            if ($after === []) {
                $item->forceFill(['status' => CopilotChangeItem::FAILED, 'note' => (string) __('ai.copilot.changes.gone')])->save();

                continue;
            }
            // Stale = only the changed fields differ from the preview (a sale moving stock never cancels a price change).
            foreach ((array) $item->before as $key => $was) {
                $field = $map[$key] ?? null;
                $now = $field !== null ? $resource->raw($row, $field) : $row->getAttribute($key);
                if (! ($field !== null ? ValueOps::same($field, $now, $was) : $now == $was)) {
                    $item->forceFill(['status' => CopilotChangeItem::SKIPPED_STALE, 'note' => (string) __('ai.copilot.changes.stale')])->save();

                    continue 2;
                }
            }

            // Every changed field a plain column → the fast path; any other one → the full request + action.
            $slow = array_filter(array_keys($after), fn (string $k) => ! ($map[$k] ?? null)?->bulk);
            if ($slow === []) {
                $columns = [];
                foreach ($after as $key => $value) {
                    $columns[$map[$key]->column] = $value;
                }
                $fast[json_encode($columns)][] = $item;

                continue;
            }

            try {
                $request = FormRequestRunner::run((string) $resource->request(), [...$resource->body($row), ...$after], $ctx->user, $resource->routeParameter(), $row);
                $resource->persist($request, $row);
                $item->forceFill(['status' => CopilotChangeItem::APPLIED, 'note' => null])->save();
            } catch (ValidationException $e) {
                $item->forceFill(['status' => CopilotChangeItem::FAILED, 'note' => mb_substr((string) (array_values(FormRequestRunner::errors($e))[0] ?? ''), 0, 200)])->save();
            } catch (ApiException $e) {
                $item->forceFill(['status' => CopilotChangeItem::FAILED, 'note' => mb_substr($e->getMessage(), 0, 200)])->save();
            }
        }

        // The fast path: one update per distinct set of new values (2,000 prices are usually a few dozen queries).
        $model = $resource->query($ctx)->getModel();
        foreach ($fast as $json => $group) {
            $model->newQuery()->whereKey(array_map(fn (CopilotChangeItem $i) => (int) $i->entity_id, $group))->update((array) json_decode($json, true));
            CopilotChangeItem::query()->whereKey(array_map(fn (CopilotChangeItem $i) => $i->id, $group))->update(['status' => CopilotChangeItem::APPLIED, 'note' => null]);
        }
    }

    private function removeDrafts(CopilotChangeSet $set, CopilotResource $resource, CopilotContext $ctx): void
    {
        $items = CopilotChangeItem::query()->where('change_set_id', $set->id)->where('status', CopilotChangeItem::PENDING)->get();
        $rows = $resource->query($ctx)->whereKey($items->pluck('entity_id')->all())->get()->keyBy(fn (Model $m) => (int) $m->getKey());
        foreach ($items as $item) {
            $row = $rows->get((int) $item->entity_id);
            if ($row === null) {
                $item->forceFill(['status' => CopilotChangeItem::REVERTED])->save();

                continue;
            }
            $created = $item->after['updated_at'] ?? null;
            $now = $row->getAttribute('updated_at')?->utc()->format('Y-m-d H:i:s');
            if ($created === null || $created !== $now) {
                $item->forceFill(['status' => CopilotChangeItem::KEPT, 'note' => (string) __('ai.copilot.changes.edited_kept')])->save();

                continue;
            }
            try {
                $resource->remove($row);
                $item->forceFill(['status' => CopilotChangeItem::REVERTED])->save();
            } catch (ApiException $e) {
                $item->forceFill(['status' => CopilotChangeItem::KEPT, 'note' => mb_substr($e->getMessage(), 0, 200)])->save();
            }
        }
        $resource->afterBulk($ctx);
        $this->count($set);
    }

    private function count(CopilotChangeSet $set): void
    {
        $counts = CopilotChangeItem::query()->where('change_set_id', $set->id)->selectRaw('status, count(*) as n')->groupBy('status')->pluck('n', 'status');
        $set->forceFill([
            'applied_count' => (int) ($counts[CopilotChangeItem::APPLIED] ?? 0),
            'skipped_count' => (int) (($counts[CopilotChangeItem::SKIPPED_STALE] ?? 0) + ($counts[CopilotChangeItem::SKIPPED_INVALID] ?? 0)),
            'failed_count' => (int) ($counts[CopilotChangeItem::FAILED] ?? 0),
        ])->save();
    }

    /** Tells the chat what happened (the model reads it in the history) and refreshes the screens. */
    private function report(CopilotChangeSet $set, User $user): void
    {
        $set->refresh();
        if ($set->chat_id !== null && CopilotChat::query()->whereKey($set->chat_id)->exists()) {
            $stale = CopilotChangeItem::query()->where('change_set_id', $set->id)->where('status', CopilotChangeItem::SKIPPED_STALE)->count();
            $text = $set->status === CopilotChangeSet::STATUS_APPLIED
                ? (string) __($set->kind === CopilotChangeSet::KIND_REVERT ? 'ai.copilot.changes.reverted_done' : 'ai.copilot.changes.applied_done', ['count' => $set->applied_count])
                    .($stale > 0 ? ' '.(string) __('ai.copilot.changes.stale_count', ['count' => $stale]) : '')
                    .($set->failed_count > 0 ? ' '.(string) __('ai.copilot.changes.failed_count', ['count' => $set->failed_count]) : '')
                : (string) ($set->error ?? __('ai.copilot.changes.failed'));
            if ($set->keep_draft && $set->kind === CopilotChangeSet::KIND_CREATE) {
                $text = (string) __('ai.copilot.changes.kept_done');
            }
            CopilotMessage::query()->create(['chat_id' => $set->chat_id, 'role' => 'assistant', 'text' => $text, 'blocks' => [['type' => 'change_set', 'id' => $set->id]], 'status' => 'done']);
        }
        $this->notify($set, $user);
    }

    private function notify(CopilotChangeSet $set, User $user): void
    {
        CopilotUpdated::notify($user->id, (int) $set->chat_id, null, $set->id);
    }

    private function ensureProposed(CopilotChangeSet $set): void
    {
        if ($set->status !== CopilotChangeSet::STATUS_PROPOSED) {
            throw ApiException::conflict('change_decided', (string) __('ai.copilot.changes.decided'));
        }
    }

    private function context(CopilotChangeSet $set, User $user): CopilotContext
    {
        return new CopilotContext(Tenant::query()->findOrFail($set->tenant_id), $user, $set->chat_id !== null ? CopilotChat::query()->find($set->chat_id) : null);
    }
}
