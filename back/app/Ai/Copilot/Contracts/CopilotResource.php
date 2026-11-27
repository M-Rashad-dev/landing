<?php

declare(strict_types=1);

namespace App\Ai\Copilot\Contracts;

use App\Ai\Copilot\CopilotContext;
use App\Ai\Copilot\Support\CopilotToolError;
use App\Enums\PlanLimit;
use App\Jobs\RevalidateTenantHosts;
use App\Support\CairoTime;
use BackedEnum;
use Carbon\CarbonImmutable;
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

    /**
     * Filters of this resource beyond its fields, by name (key => JSON Schema), when the dashboard already has them
     * (orders: q / status / source…, products: status tabs). They are applied by base(), the same code as the page.
     *
     * @return array<string, array<string, mixed>>
     */
    public function namedFilters(): array
    {
        return [];
    }

    /**
     * The query with the named filters applied (default: no named filters). Field filters and the sort go on top.
     *
     * @param  array<string, mixed>  $named
     */
    public function base(array $named, CopilotContext $ctx): Builder
    {
        return $this->query($ctx);
    }

    /**
     * A named filter's value checked against its allowed list (null when not given).
     *
     * @param  array<string, mixed>  $named
     * @param  list<string>  $allowed
     */
    protected static function pick(array $named, string $key, array $allowed): ?string
    {
        if (! isset($named[$key]) || $named[$key] === '') {
            return null;
        }
        $value = is_scalar($named[$key]) ? (string) $named[$key] : '';
        if (! in_array($value, $allowed, true)) {
            throw new CopilotToolError("{$key} is one of: ".implode(', ', $allowed).'.');
        }

        return $value;
    }

    /** @param array<string, mixed> $named */
    protected static function pickId(array $named, string $key): ?int
    {
        if (! isset($named[$key]) || $named[$key] === '') {
            return null;
        }
        if (! is_numeric($named[$key]) || (int) $named[$key] < 1) {
            throw new CopilotToolError("{$key} must be an id.");
        }

        return (int) $named[$key];
    }

    /** Whether base() already sorts (a named «sort» filter): then the default newest-first order is not added. */
    public function sortsItself(): bool
    {
        return array_key_exists('sort', $this->namedFilters());
    }

    /** @return list<string> relations loaded for the rows shown */
    public function with(): array
    {
        return [];
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

    /** One field's value in a plain shape (money as «199.00», Cairo dates Y-m-d H:i, enums as their value). */
    public function value(Model $row, Field $field): mixed
    {
        $value = $field->using !== null ? ($field->using)($row) : $row->getAttribute($field->column);

        return match (true) {
            $value instanceof BackedEnum => $value->value,
            $value instanceof DateTimeInterface => CarbonImmutable::instance($value)->setTimezone(CairoTime::ZONE)->format('Y-m-d H:i'),
            $field->type === 'money' && $value !== null && is_numeric($value) => number_format((float) $value, 2, '.', ''),
            default => $value,
        };
    }

    /**
     * The stored value the change math works on: money «199.00», ints, bools, enum values, dates as UTC
     * «Y-m-d H:i:s», ids lists (computed fields through using()).
     */
    public function raw(Model $row, Field $field): mixed
    {
        $value = $field->using !== null ? ($field->using)($row) : $row->getAttribute($field->column);

        return match (true) {
            $value instanceof BackedEnum => $value->value,
            $value instanceof DateTimeInterface => CarbonImmutable::instance($value)->utc()->format('Y-m-d H:i:s'),
            $field->type === 'money' && $value !== null && is_numeric($value) => number_format((float) $value, 2, '.', ''),
            $field->type === 'int' && $value !== null => (int) $value,
            $field->type === 'bool' => (bool) $value,
            default => $value,
        };
    }

    /** The value as the merchant reads it in tables and files: enum labels, «نعم / لا», lists joined. */
    public function cell(Model $row, Field $field): string
    {
        $value = $this->value($row, $field);

        return match (true) {
            $value === null => '',
            $field->type === 'bool' => (string) __($value ? 'ai.copilot.yes' : 'ai.copilot.no'),
            $field->type === 'enum' => $field->labels[(string) $value] ?? (string) $value,
            is_array($value) => implode('، ', array_map(fn ($v) => is_scalar($v) ? (string) $v : '', $value)),
            is_scalar($value) => (string) $value,
            default => '',
        };
    }

    /**
     * The merchant's table / file columns: every field (personal data included: it never reaches the model).
     *
     * @return list<array{key: string, label: string, kind: string}>
     */
    public function columns(): array
    {
        return array_values(array_map(fn (Field $f) => ['key' => $f->key, 'label' => $f->label, 'kind' => $f->type], array_filter($this->fields(), fn (Field $f) => $f->inTable)));
    }

    /**
     * One row for the merchant's table / file.
     *
     * @return array<string, string|int>
     */
    public function tableRow(Model $row): array
    {
        $out = ['id' => (int) $row->getKey()];
        foreach ($this->fields() as $field) {
            if ($field->inTable) {
                $out[$field->key] = $this->cell($row, $field);
            }
        }
        $url = $this->url($row);
        if ($url !== null) {
            $out['_url'] = $url;
        }

        return $out;
    }

    /**
     * Columns an Excel file adds after the fields, read from the rows about to be written (e.g. the products' spec
     * rows «لابتوب: المعالج»). Null = none.
     *
     * @param  Builder<Model>  $query  the export's rows
     * @return array{headers: list<string>, cells: \Closure(Model): list<string>}|null
     */
    public function exportColumns(Builder $query): ?array
    {
        return null;
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

    /**
     * A change's values as request keys (applied on top of body()). Default: dates go as ISO UTC («…Z»), which every
     * dashboard date rule reads. Resources map virtual fields here (e.g. seo_title → seo.title).
     *
     * @param  array<string, mixed>  $after
     * @return array<string, mixed>
     */
    public function requestData(array $after, Model $row): array
    {
        $map = $this->fieldMap();
        foreach ($after as $key => $value) {
            if (($map[$key] ?? null)?->type === 'date' && is_string($value) && $value !== '') {
                $after[$key] = str_replace(' ', 'T', $value).'Z';
            }
        }

        return $after;
    }

    /** Saves through the platform Action, exactly like the dashboard controller. */
    public function persist(FormRequest $validated, ?Model $row): Model
    {
        throw new LogicException(static::class.' is read only.');
    }

    /**
     * Request values a new record gets unless the item gives them (e.g. an empty list the request requires).
     *
     * @return array<string, mixed>
     */
    public function createDefaults(): array
    {
        return [];
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

    /** The plan limit new records count against (checked before a batch is created). */
    public function limit(): ?PlanLimit
    {
        return null;
    }

    /**
     * What create_records accepts per item (request key => short English hint), for `describe`.
     *
     * @return array<string, string>
     */
    public function createFields(): array
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
            'named_filters' => $this->namedFilters() !== [] ? $this->namedFilters() : null,
            'can_create' => $this->creatable(),
            'create_fields' => $this->creatable() ? $this->createFields() : null,
            'can_update' => $this->writable() && array_filter($fields, fn (Field $f) => $f->editable) !== [],
        ];
    }
}
