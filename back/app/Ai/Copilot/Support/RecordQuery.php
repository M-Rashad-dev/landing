<?php

declare(strict_types=1);

namespace App\Ai\Copilot\Support;

use App\Ai\Copilot\Contracts\CopilotResource;
use App\Ai\Copilot\Contracts\Field;
use App\Ai\Copilot\CopilotContext;
use Illuminate\Database\Eloquent\Builder;

/**
 * Turns the model's filters into Eloquent (docs/plans/ai-copilot.md §3.4): named filters go to the resource's own
 * code (the dashboard's), field filters only on `filterable` fields with the operators their type allows, `q` over
 * the `searchable` fields, and `sort` («price» / «-price») only on `sortable` ones. Anything else is a tool error the
 * model can fix: no column name, operator or SQL ever comes from the model as is.
 */
final class RecordQuery
{
    /** Operators each field type accepts. */
    public const OPS = [
        'text' => ['eq', 'ne', 'in', 'contains', 'empty', 'not_empty'],
        'textarea' => ['contains', 'empty', 'not_empty'],
        'money' => ['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'between', 'empty', 'not_empty'],
        'int' => ['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'between', 'in', 'empty', 'not_empty'],
        'bool' => ['eq'],
        'enum' => ['eq', 'ne', 'in'],
        'date' => ['eq', 'gte', 'lte', 'between', 'period', 'empty', 'not_empty'],
    ];

    /**
     * @param  array<string, mixed>  $filters
     */
    public static function build(CopilotResource $resource, array $filters, ?string $sort, CopilotContext $ctx): Builder
    {
        $named = [];
        $fields = [];
        $namedKeys = array_keys($resource->namedFilters());
        foreach ($filters as $key => $value) {
            in_array($key, $namedKeys, true) ? $named[$key] = $value : $fields[$key] = $value;
        }
        if ($sort !== null && $sort !== '' && in_array('sort', $namedKeys, true) && ! self::isFieldSort($resource, $sort)) {
            $named['sort'] = $sort;
            $sort = null;
        }

        $query = $resource->base($named, $ctx);
        $map = $resource->fieldMap();
        foreach ($fields as $key => $value) {
            if ($key === 'q') {
                self::search($query, $resource, (string) (is_scalar($value) ? $value : ''));

                continue;
            }
            $field = $map[$key] ?? null;
            if ($field === null || ! $field->filterable || $field->using !== null || $field->hidden) {
                $allowed = array_merge(array_keys(array_filter($map, fn (Field $f) => $f->filterable && $f->using === null && ! $f->hidden)), $namedKeys, self::searchable($resource) !== [] ? ['q'] : []);
                throw new CopilotToolError("«{$key}» is not a filter of {$resource->key()}. Filters: ".implode(', ', $allowed).'.');
            }
            self::filter($query, $field, $value);
        }

        if ($sort !== null && $sort !== '') {
            $column = ltrim($sort, '-');
            $field = $map[$column] ?? null;
            if ($field === null || ! $field->sortable || $field->using !== null) {
                $sortable = array_keys(array_filter($map, fn (Field $f) => $f->sortable && $f->using === null));
                throw new CopilotToolError("Can't sort {$resource->key()} by «{$sort}». Sort by: ".implode(', ', $sortable).' (prefix - for descending).');
            }
            $query->reorder()->orderBy($field->column, str_starts_with($sort, '-') ? 'desc' : 'asc')->orderBy($query->getModel()->getQualifiedKeyName(), 'desc');
        } elseif (! $resource->sortsItself()) {
            $query->orderBy($query->getModel()->getQualifiedKeyName(), 'desc');
        }

        return $query;
    }

    private static function isFieldSort(CopilotResource $resource, string $sort): bool
    {
        $field = $resource->fieldMap()[ltrim($sort, '-')] ?? null;

        return $field !== null && $field->sortable && $field->using === null;
    }

    /** @return list<Field> */
    private static function searchable(CopilotResource $resource): array
    {
        return array_values(array_filter($resource->fields(), fn (Field $f) => $f->searchable && $f->using === null));
    }

    private static function search(Builder $query, CopilotResource $resource, string $q): void
    {
        $q = trim(mb_substr($q, 0, 100));
        $fields = self::searchable($resource);
        if ($q === '' || $fields === []) {
            if ($fields === []) {
                throw new CopilotToolError("{$resource->key()} has no text search.");
            }

            return;
        }
        $like = '%'.addcslashes($q, '%_\\').'%';
        $query->where(function (Builder $w) use ($fields, $like): void {
            foreach ($fields as $field) {
                $w->orWhere($field->column, 'like', $like);
            }
        });
    }

    private static function filter(Builder $query, Field $field, mixed $value): void
    {
        // A plain value means «equals» (a period preset name on a date means that period).
        if (! is_array($value) || array_is_list($value)) {
            $value = is_array($value) ? ['in' => $value] : ($field->type === 'date' && is_string($value) && in_array($value, Period::PRESETS, true) ? ['period' => $value] : ['eq' => $value]);
        }
        $allowed = self::OPS[$field->type] ?? [];
        $column = $field->column;
        foreach ($value as $op => $operand) {
            if (! in_array($op, $allowed, true)) {
                throw new CopilotToolError("«{$op}» doesn't work on {$field->key} ({$field->type}). Use: ".implode(', ', $allowed).'.');
            }
            match ($op) {
                'eq' => $field->type === 'date' ? self::dayRange($query, $column, Period::from(['from' => (string) $operand, 'to' => (string) $operand])) : $query->where($column, self::scalar($field, $operand)),
                'ne' => $query->where($column, '!=', self::scalar($field, $operand)),
                'gt' => $query->where($column, '>', self::scalar($field, $operand)),
                'gte' => $field->type === 'date' ? $query->where($column, '>=', Period::from(['from' => (string) $operand, 'to' => (string) $operand])->utcBounds()[0]) : $query->where($column, '>=', self::scalar($field, $operand)),
                'lt' => $query->where($column, '<', self::scalar($field, $operand)),
                'lte' => $field->type === 'date' ? $query->where($column, '<', Period::from(['from' => (string) $operand, 'to' => (string) $operand])->utcBounds()[1]) : $query->where($column, '<=', self::scalar($field, $operand)),
                'between' => self::between($query, $field, $operand),
                'period' => self::dayRange($query, $column, Period::preset((string) $operand)),
                'in' => $query->whereIn($column, array_map(fn ($v) => self::scalar($field, $v), array_slice((array) $operand, 0, 500))),
                'contains' => $query->where($column, 'like', '%'.addcslashes((string) self::scalar($field, $operand), '%_\\').'%'),
                // '' only means empty for text (a number column would cast it to 0).
                'empty' => in_array($field->type, ['text', 'textarea'], true) ? $query->where(fn (Builder $w) => $w->whereNull($column)->orWhere($column, '')) : $query->whereNull($column),
                'not_empty' => in_array($field->type, ['text', 'textarea'], true) ? $query->whereNotNull($column)->where($column, '!=', '') : $query->whereNotNull($column),
            };
        }
    }

    private static function between(Builder $query, Field $field, mixed $operand): void
    {
        if (! is_array($operand) || count($operand) !== 2) {
            throw new CopilotToolError("between needs [min, max] for {$field->key}.");
        }
        [$min, $max] = array_values($operand);
        $field->type === 'date'
            ? self::dayRange($query, $field->column, Period::from(['from' => (string) $min, 'to' => (string) $max]))
            : $query->whereBetween($field->column, [self::scalar($field, $min), self::scalar($field, $max)]);
    }

    private static function dayRange(Builder $query, string $column, Period $period): void
    {
        [$start, $end] = $period->utcBounds();
        $query->where($column, '>=', $start)->where($column, '<', $end);
    }

    /** A checked value for the field's type. */
    private static function scalar(Field $field, mixed $value): string|int|float|bool|null
    {
        if ($value === null) {
            return null;
        }
        if (! is_scalar($value)) {
            throw new CopilotToolError("{$field->key} needs a plain value.");
        }

        return match ($field->type) {
            'money' => is_numeric($value) ? round((float) $value, 2) : throw new CopilotToolError("{$field->key} needs a number."),
            'int' => is_numeric($value) ? (int) $value : throw new CopilotToolError("{$field->key} needs a whole number."),
            'bool' => filter_var($value, FILTER_VALIDATE_BOOLEAN),
            'enum' => in_array((string) $value, $field->values, true) ? (string) $value : throw new CopilotToolError("{$field->key} is one of: ".implode(', ', $field->values).'.'),
            default => mb_substr((string) $value, 0, 200),
        };
    }
}
