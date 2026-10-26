<?php

declare(strict_types=1);

namespace App\Rules;

use App\Tenancy\Tenancy;
use Closure;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Facades\DB;

/**
 * Tenant-aware replacement for `exists:`. Fails when no tenant is known.
 * Usage: TenantExists::table('products')->ignoreTrashed()
 */
final class TenantExists implements ValidationRule
{
    private bool $excludeTrashed = false;

    /** @var list<array{0: string, 1: mixed}> */
    private array $wheres = [];

    private function __construct(
        private readonly string $table,
        private readonly string $column = 'id',
    ) {}

    public static function table(string $table, string $column = 'id'): self
    {
        return new self($table, $column);
    }

    /** Treat soft-deleted rows as missing. */
    public function ignoreTrashed(): self
    {
        $this->excludeTrashed = true;

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

        if ($tenantId === null || ! is_scalar($value) || $value === '') {
            $fail('validation.exists')->translate();

            return;
        }

        $query = DB::table($this->table)
            ->where('tenant_id', $tenantId)
            ->where($this->column, $value)
            ->when($this->excludeTrashed, fn (Builder $q) => $q->whereNull('deleted_at'));

        foreach ($this->wheres as [$column, $expected]) {
            $query->where($column, $expected);
        }

        if (! $query->exists()) {
            $fail('validation.exists')->translate();
        }
    }
}
