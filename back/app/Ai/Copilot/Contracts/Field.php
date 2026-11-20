<?php

declare(strict_types=1);

namespace App\Ai\Copilot\Contracts;

use BackedEnum;
use InvalidArgumentException;

/**
 * One field of a copilot resource (docs/plans/ai-copilot.md §3.3): what it is, what the model may do
 * with it (filter, sort, search, edit) and how it is shown. The type decides the allowed change ops.
 */
final class Field
{
    public const TYPES = ['text', 'textarea', 'money', 'int', 'bool', 'enum', 'date', 'ids', 'media'];

    /** The change ops each type accepts (computed in PHP by ValueOps, never by the model). */
    public const OPS = [
        'text' => ['set', 'replace', 'prepend', 'append'],
        'textarea' => ['set', 'replace', 'prepend', 'append'],
        'money' => ['set', 'add', 'percent', 'clear'],
        'int' => ['set', 'add'],
        'bool' => ['set'],
        'enum' => ['set'],
        'date' => ['set', 'shift_days'],
        'ids' => ['add', 'remove', 'set'],
        'media' => ['set'],
    ];

    public string $label;

    public string $column;

    public bool $filterable = false;

    public bool $sortable = false;

    public bool $searchable = false;

    public bool $editable = false;

    public bool $bulk = false;

    public bool $hidden = false;

    public bool $nullable = false;

    /** @var list<mixed> */
    public array $rules = [];

    /** @var list<string> */
    public array $values = [];

    private function __construct(public readonly string $key, public readonly string $type)
    {
        if (! preg_match('/^[a-z][a-z0-9_]{0,59}$/', $key)) {
            throw new InvalidArgumentException("Bad copilot field key «{$key}».");
        }
        $this->label = $key;
        $this->column = $key;
    }

    public static function text(string $key): self
    {
        return new self($key, 'text');
    }

    public static function textarea(string $key): self
    {
        return new self($key, 'textarea');
    }

    public static function money(string $key): self
    {
        return new self($key, 'money');
    }

    public static function int(string $key): self
    {
        return new self($key, 'int');
    }

    public static function bool(string $key): self
    {
        return new self($key, 'bool');
    }

    /** @param class-string<BackedEnum>|list<string> $values */
    public static function enum(string $key, string|array $values): self
    {
        $field = new self($key, 'enum');
        $field->values = is_string($values)
            ? array_map(fn (BackedEnum $case) => (string) $case->value, $values::cases())
            : array_values(array_map('strval', $values));

        return $field;
    }

    public static function date(string $key): self
    {
        return new self($key, 'date');
    }

    /** Related ids (e.g. category_ids): add / remove / set. */
    public static function ids(string $key): self
    {
        return new self($key, 'ids');
    }

    public static function media(string $key): self
    {
        return new self($key, 'media');
    }

    public function label(string $label): self
    {
        $this->label = $label;

        return $this;
    }

    public function column(string $column): self
    {
        $this->column = $column;

        return $this;
    }

    public function filterable(): self
    {
        $this->filterable = true;

        return $this;
    }

    public function sortable(): self
    {
        $this->sortable = true;

        return $this;
    }

    public function searchable(): self
    {
        $this->searchable = true;

        return $this;
    }

    /** May be changed by update_records (through the resource's request and action). */
    public function editable(): self
    {
        $this->editable = true;

        return $this;
    }

    /** Editable and safe for the fast path: one plain column, no side effects. */
    public function bulk(): self
    {
        $this->editable = true;
        $this->bulk = true;

        return $this;
    }

    /** Never shown to the model (personal data, secrets). */
    public function hidden(): self
    {
        $this->hidden = true;

        return $this;
    }

    public function nullable(): self
    {
        $this->nullable = true;

        return $this;
    }

    /** @param list<mixed> $rules Laravel rules for one value of this field (the fast path checks them). */
    public function rules(array $rules): self
    {
        $this->rules = $rules;

        return $this;
    }

    /** @return list<string> */
    public function ops(): array
    {
        $ops = self::OPS[$this->type];

        return $this->nullable || $this->type !== 'money' ? $ops : array_values(array_diff($ops, ['clear']));
    }

    /** What the model learns about the field from `describe`. */
    public function describe(): array
    {
        return array_filter([
            'key' => $this->key,
            'type' => $this->type,
            'label' => $this->label,
            'values' => $this->values ?: null,
            'nullable' => $this->nullable ?: null,
            'filterable' => $this->filterable ?: null,
            'sortable' => $this->sortable ?: null,
            'searchable' => $this->searchable ?: null,
            'ops' => $this->editable ? $this->ops() : null,
        ], fn ($v) => $v !== null);
    }
}
