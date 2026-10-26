<?php

declare(strict_types=1);

namespace App\Rules;

use App\Tenancy\Tenancy;
use Closure;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Facades\DB;

/**
 * Tenant-aware replacement for `unique:`. Fails when no tenant is known.
 * Usage: TenantUnique::table('discount_codes', 'code')->ignore($id)->ignoreTrashed()
 */
final class TenantUnique implements ValidationRule
{
    private int|string|null $ignoreId = null;

    private bool $excludeTrashed = false;

    private bool $caseInsensitive = false;

    /** @var list<array{0: string, 1: mixed}> */
    private array $wheres = [];

    private function __construct(
        private readonly string $table,
        private readonly string $column,
    ) {}

    public static function table(string $table, string $column): self
    {
        return new self($table, $column);
    }

    public function ignore(int|string|null $id): self
    {
        $this->ignoreId = $id;

        return $this;
    }

    /** Soft-deleted rows do not count as duplicates. */
    public function ignoreTrashed(): self
    {
        $this->excludeTrashed = true;

        return $this;
    }

    public function caseInsensitive(): self
    {
        $this->caseInsensitive = true;

        return $this;
    }

    public function where(string $column, mixed $value): self
    {
        $this->wheres[] = [$column, $value];

        return $this;
    }

    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        $tenantId = Tenancy::id();

        if ($tenantId === null) {
            $fail('validation.unique')->translate();

            return;
        }

        if (! is_scalar($value)) {
            return;
        }

        $query = DB::table($this->table)
            ->where('tenant_id', $tenantId)
            ->when(
                $this->caseInsensitive,
                fn (Builder $q) => $q->whereRaw('LOWER('.$this->column.') = ?', [mb_strtolower((string) $value)]),
                fn (Builder $q) => $q->where($this->column, $value),
            )
            ->when($this->ignoreId !== null, fn (Builder $q) => $q->where('id', '!=', $this->ignoreId))
            ->when($this->excludeTrashed, fn (Builder $q) => $q->whereNull('deleted_at'));

        foreach ($this->wheres as [$column, $expected]) {
            $query->where($column, $expected);
        }

        if ($query->exists()) {
            $fail('validation.unique')->translate();
        }
    }
}
