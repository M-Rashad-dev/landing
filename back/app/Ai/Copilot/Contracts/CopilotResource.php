<?php

declare(strict_types=1);

namespace App\Ai\Copilot\Contracts;

use App\Ai\Copilot\CopilotContext;
use App\Jobs\RevalidateTenantHosts;
use BackedEnum;
use DateTimeInterface;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Str;
use LogicException;

/**
 * The records of one platform model, as the copilot sees them (docs/plans/ai-copilot.md §3.3): its fields
 * (what can be filtered, sorted, searched, edited), how a row is shown, and, when it can be written, which
 * FormRequest validates it and which platform Action saves it. The copilot never re-implements a feature: it
 * goes through the same request and action as the dashboard.
 *
 * A resource without request() is read only.
 */
abstract class CopilotResource implements CopilotCapability
{
    /** @return class-string<Model> */
    abstract public function model(): string;

    /** @return list<Field> */
    abstract public function fields(): array;

    public function available(CopilotContext $ctx): bool
    {
        return true;
    }

    /** The rows the copilot may see (the tenant scope always applies on top). */
    public function query(CopilotContext $ctx): Builder
    {
        return $this->model()::query();
    }

    /** The name the merchant sees for a row («حذاء رياضي»). */
    public function labelOf(Model $row): string
    {
        foreach (['name', 'title', 'code', 'host', 'order_number'] as $attribute) {
            $value = $row->getAttribute($attribute);
            if (is_scalar($value) && (string) $value !== '') {
                return mb_substr((string) $value, 0, 160);
            }
        }

        return '#'.$row->getKey();
    }

    /**
     * A compact row. For the model ($forModel) hidden fields are left out (personal data, secrets); the
     * merchant's own tables and files get every field.
     *
     * @return array<string, mixed>
     */
    public function present(Model $row, bool $forModel): array
    {
        $out = ['id' => $row->getKey()];
        foreach ($this->fields() as $field) {
            if ($forModel && $field->hidden) {
                continue;
            }
            $out[$field->key] = $this->value($row, $field);
        }

        return $out;
    }

    /** One field's value in a plain shape (money as «199.00», dates Y-m-d H:i, enums as their value). */
    public function value(Model $row, Field $field): mixed
    {
        $value = $row->getAttribute($field->column);

        return match (true) {
            $value instanceof BackedEnum => $value->value,
            $value instanceof DateTimeInterface => $value->format('Y-m-d H:i'),
            $field->type === 'money' && $value !== null => number_format((float) $value, 2, '.', ''),
            default => $value,
        };
    }

    /** @return array<string, Field> */
    public function fieldMap(): array
    {
        $map = [];
        foreach ($this->fields() as $field) {
            $map[$field->key] = $field;
        }

        return $map;
    }

    // ── Writes (optional) ─────────────────────────────────────────────

    /** @return class-string<FormRequest>|null the request the dashboard validates this model with; null = read only */
    public function request(): ?string
    {
        return null;
    }

    public function writable(): bool
    {
        return $this->request() !== null;
    }

    /** The route parameter name the request reads the current row from ($this->route('…')). */
    public function routeParameter(): string
    {
        return Str::snake(Str::singular($this->key()));
    }

    /**
     * The row's current values as a request body, so one field can change through the full request.
     *
     * @return array<string, mixed>
     */
    public function body(Model $row): array
    {
        throw new LogicException(static::class.' does not support full updates.');
    }

    /** Saves through the platform Action, exactly like the dashboard controller. */
    public function persist(FormRequest $validated, ?Model $row): Model
    {
        throw new LogicException(static::class.' is read only.');
    }

    /**
     * Values a new record gets as a draft (Hold): not live for customers until published.
     *
     * @return array<string, mixed>
     */
    public function draft(): array
    {
        return [];
    }

    /**
     * Values that publish a draft.
     *
     * @return array<string, mixed>
     */
    public function publish(): array
    {
        return [];
    }

    /** Whether new records can be created as drafts (create_records). */
    public function creatable(): bool
    {
        return $this->writable() && $this->draft() !== [];
    }

    /** Deletes one of the copilot's own untouched drafts (platform delete action). */
    public function remove(Model $row): void
    {
        throw new LogicException(static::class.' cannot remove records.');
    }

    /**
     * A cross-field check for the fast path (e.g. compare_at_price above price). An Arabic message, or null.
     *
     * @param  array<string, mixed>  $after  the row's changed values
     */
    public function validateRow(array $after, Model $row): ?string
    {
        return null;
    }

    /** Runs once after a batch of changes (default: refresh the store's cached pages). */
    public function afterBulk(CopilotContext $ctx): void
    {
        RevalidateTenantHosts::dispatch($ctx->tenant->id)->afterCommit();
    }

    /** The dashboard page of a row (or of the list when null), for links in the chat. */
    public function url(?Model $row): ?string
    {
        return null;
    }

    // ── For the model ─────────────────────────────────────────────────

    /** The catalog line: «products: المنتجات — find, create (draft), update [price, …]». */
    public function catalogLine(): string
    {
        $abilities = ['find'];
        if ($this->creatable()) {
            $abilities[] = 'create (draft)';
        }
        $editable = array_values(array_map(fn (Field $f) => $f->key, array_filter($this->fields(), fn (Field $f) => $f->editable)));
        if ($this->writable() && $editable !== []) {
            $abilities[] = 'update ['.implode(', ', $editable).']';
        }

        return "{$this->key()}: {$this->label()} — ".implode(', ', $abilities).'. '.$this->summary();
    }

    public function describe(CopilotContext $ctx): array
    {
        $fields = array_values(array_filter($this->fields(), fn (Field $f) => ! $f->hidden));

        return [
            'kind' => 'resource',
            'key' => $this->key(),
            'label' => $this->label(),
            'summary' => $this->summary(),
            'fields' => array_map(fn (Field $f) => $f->describe(), $fields),
            'can_create' => $this->creatable(),
            'can_update' => $this->writable() && array_filter($fields, fn (Field $f) => $f->editable) !== [],
        ];
    }
}
