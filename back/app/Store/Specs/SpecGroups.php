<?php

declare(strict_types=1);

namespace App\Store\Specs;

use App\Exceptions\ApiException;
use App\Jobs\RevalidateTenantHosts;
use App\Models\Product;
use App\Models\ProductSpecRow;
use App\Models\ProductSpecTable;
use App\Models\SpecGroup;
use App\Models\SpecGroupRow;
use App\Tenancy\Tenancy;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * «مجموعات المواصفات» (docs/plans/tekno/PLAN.md §1): the store's reusable spec tables, adding a group to many products
 * at once, sending a group's new rows to the products that use it («ضيف التعديل»), and the fill grid («املأ القيم»).
 * A group never changes a product's values or removes its rows: products own their copies.
 */
final class SpecGroups
{
    public const GRID_PAGE = 50;

    public function __construct(private readonly ProductSpecs $specs) {}

    public static function max(): int
    {
        return (int) config('landing.limits.spec_groups');
    }

    /** @param array{name: string, rows: list<array<string, mixed>>} $data */
    public function create(array $data): SpecGroup
    {
        if (SpecGroup::query()->count() >= self::max()) {
            throw new ApiException(422, 'limit_reached', __('specs.too_many_groups', ['max' => self::max()]));
        }

        return DB::transaction(function () use ($data): SpecGroup {
            $group = SpecGroup::query()->create(['name' => $data['name'], 'position' => (int) SpecGroup::query()->max('position') + 1]);
            $this->saveRows($group, $data['rows']);

            return $group->load('rows');
        });
    }

    /** @param array{name: string, rows: list<array<string, mixed>>} $data rows replaced in order */
    public function update(SpecGroup $group, array $data): SpecGroup
    {
        return DB::transaction(function () use ($group, $data): SpecGroup {
            $group->update(['name' => $data['name']]);
            SpecGroupRow::query()->where('spec_group_id', $group->id)->delete();
            $this->saveRows($group, $data['rows']);

            return $group->load('rows');
        });
    }

    /** The products keep their copies (unlinked: they stop receiving «ضيف التعديل»). */
    public function delete(SpecGroup $group): void
    {
        $group->delete();
    }

    /**
     * Adds the group to the products that don't have it yet (a product at its tables limit is skipped).
     *
     * @param  list<int>  $productIds
     * @return array{added: int, skipped: int}
     */
    public function apply(SpecGroup $group, array $productIds): array
    {
        $group->loadMissing('rows');
        $ids = array_values(array_unique($productIds));
        $state = $this->state($ids);
        $added = 0;

        DB::transaction(function () use ($group, $ids, $state, &$added): void {
            foreach (Product::query()->whereKey($ids)->orderBy('id')->get(['id', 'tenant_id']) as $product) {
                $own = $state->get($product->id, collect());
                if ($own->contains(fn (ProductSpecTable $t) => $t->spec_group_id === $group->id) || $own->count() >= ProductSpecs::maxTables()) {
                    continue;
                }
                $room = ProductSpecs::maxCardRows() - (int) $own->sum('card_count');
                $this->specs->insert($product, [[
                    'spec_group_id' => $group->id,
                    'name' => $group->name,
                    'rows' => ProductSpecs::rowsFromGroup($group->rows, $room),
                ]], $own->isEmpty() ? 0 : (int) $own->max('position') + 1);
                $added++;
            }
        });
        if ($added > 0) {
            RevalidateTenantHosts::dispatch((int) Tenancy::id())->afterCommit();
        }

        return ['added' => $added, 'skipped' => count($ids) - $added];
    }

    /**
     * «ضيف التعديل للمنتجات اللي بتستخدمها»: appends the group's rows a product's copy lacks (by label), after its
     * own rows. Values, renamed or removed rows of the products are never touched.
     *
     * @return int the products changed
     */
    public function push(SpecGroup $group): int
    {
        $group->loadMissing('rows');
        $updated = 0;

        $this->linked($group)->chunkById(200, function (Collection $tables) use ($group, &$updated): void {
            $state = $this->state($tables->pluck('product_id')->map(fn ($id) => (int) $id)->all());
            DB::transaction(function () use ($tables, $group, $state, &$updated): void {
                foreach ($tables as $table) {
                    /** @var ProductSpecTable $table */
                    $room = ProductSpecs::maxCardRows() - (int) $state->get($table->product_id, collect())->sum('card_count');
                    if ($this->appendMissing($table, $group->rows, $room) > 0) {
                        $updated++;
                    }
                }
            });
        });
        if ($updated > 0) {
            RevalidateTenantHosts::dispatch((int) Tenancy::id())->afterCommit();
        }

        return $updated;
    }

    /**
     * «املأ القيم»: the products using the group with their values by label (the group's labels only).
     *
     * @return LengthAwarePaginator<int, Product>
     */
    public function grid(SpecGroup $group, int $page): LengthAwarePaginator
    {
        return Product::query()
            ->whereHas('specTables', fn (Builder $q) => $q->where('spec_group_id', $group->id))
            ->with(['media', 'specTables' => fn ($q) => $q->where('spec_group_id', $group->id)->with('rows')])
            ->orderBy('name')
            ->orderBy('id')
            ->paginate(self::GRID_PAGE, ['*'], 'page', max(1, $page));
    }

    /**
     * One grid row: the product and its values for the group's labels (missing rows → null).
     *
     * @return array{product_id: int, name: string, image: string|null, values: array<string, string|null>}
     */
    public function gridRow(SpecGroup $group, Product $product): array
    {
        /** @var ProductSpecTable|null $table */
        $table = $product->specTables->first();
        $byLabel = $table === null ? collect() : $table->rows->keyBy(fn (ProductSpecRow $r) => ProductSpecs::key($r->label));
        $values = [];
        foreach ($group->rows as $row) {
            $values[$row->label] = $byLabel->get(ProductSpecs::key($row->label))?->value;
        }
        $image = $product->media->first();

        return ['product_id' => $product->id, 'name' => $product->name, 'image' => $image?->urls()['thumb'] ?? null, 'values' => $values];
    }

    /**
     * Saves the grid's changed rows. A label missing from a product's copy is added (with the group's flags).
     *
     * @param  list<array{product_id: int, values: list<array{label: string, value: string|null}>}>  $rows
     * @return int the products changed
     */
    public function saveGrid(SpecGroup $group, array $rows): int
    {
        $group->loadMissing('rows');
        $groupRows = $group->rows->keyBy(fn (SpecGroupRow $r) => ProductSpecs::key($r->label));
        $ids = array_map(fn (array $r) => (int) $r['product_id'], $rows);
        $tables = $this->linked($group)->whereIn('product_id', $ids)->with('rows')->get()->keyBy('product_id');

        $errors = [];
        foreach ($rows as $i => $row) {
            if (! $tables->has((int) $row['product_id'])) {
                $errors["rows.{$i}.product_id"] = [__('specs.not_using_group')];
            }
            foreach ($row['values'] as $j => $cell) {
                if (! $groupRows->has(ProductSpecs::key($cell['label']))) {
                    $errors["rows.{$i}.values.{$j}.label"] = [__('specs.label_not_in_group')];
                }
            }
        }
        if ($errors !== []) {
            throw ValidationException::withMessages($errors);
        }

        $state = $this->state($ids);
        $updated = 0;
        DB::transaction(function () use ($rows, $tables, $groupRows, $state, &$updated): void {
            foreach ($rows as $row) {
                /** @var ProductSpecTable $table */
                $table = $tables->get((int) $row['product_id']);
                $byLabel = $table->rows->keyBy(fn (ProductSpecRow $r) => ProductSpecs::key($r->label));
                $room = ProductSpecs::maxCardRows() - (int) $state->get($table->product_id, collect())->sum('card_count');
                $changed = false;
                $missing = collect();
                $values = [];
                foreach ($row['values'] as $cell) {
                    $key = ProductSpecs::key($cell['label']);
                    $value = isset($cell['value']) && trim((string) $cell['value']) !== '' ? (string) $cell['value'] : null;
                    $values[$key] = $value;
                    $existing = $byLabel->get($key);
                    if ($existing === null) {
                        if ($value !== null) {
                            $missing->push($groupRows->get($key));
                        }
                    } elseif ($existing->value !== $value) {
                        $existing->update(['value' => $value]);
                        $changed = true;
                    }
                }
                if ($missing->isNotEmpty() && $this->appendMissing($table, $missing, $room, $values) > 0) {
                    $changed = true;
                }
                if ($changed) {
                    $updated++;
                }
            }
        });
        if ($updated > 0) {
            RevalidateTenantHosts::dispatch((int) Tenancy::id())->afterCommit();
        }

        return $updated;
    }

    /**
     * How many products use each group (live products only).
     *
     * @return Builder<SpecGroup>
     */
    public function listQuery(): Builder
    {
        return SpecGroup::query()
            ->withCount('rows')
            ->withCount(['tables as products_count' => fn (Builder $q) => $q->whereHas('product')])
            ->orderBy('position')
            ->orderBy('id');
    }

    /**
     * Appends the given group rows the table lacks (by label), keeping the rows limit; values when given (grid).
     *
     * @param  Collection<int, SpecGroupRow>  $groupRows
     * @param  array<string, string|null>  $values  label key → value
     * @return int rows added
     */
    private function appendMissing(ProductSpecTable $table, Collection $groupRows, int $cardRoom, array $values = []): int
    {
        $table->loadMissing('rows');
        $have = $table->rows->map(fn (ProductSpecRow $r) => ProductSpecs::key($r->label))->flip();
        $next = $table->rows->isEmpty() ? 0 : (int) $table->rows->max('position') + 1;
        $count = $table->rows->count();
        $insert = [];
        foreach ($groupRows as $row) {
            $key = ProductSpecs::key($row->label);
            if ($have->has($key) || $count >= ProductSpecs::maxRows()) {
                continue;
            }
            [$copy] = ProductSpecs::rowsFromGroup(collect([$row]), $cardRoom);
            $copy['value'] = $values[$key] ?? null;
            $insert[] = ProductSpecs::rowValues($table, $copy, $next++);
            $have->put($key, true);
            $count++;
        }
        if ($insert !== []) {
            ProductSpecRow::query()->insert($insert);
            $table->unsetRelation('rows');
        }

        return count($insert);
    }

    /**
     * The products' tables with their card-row counts (room left for «يظهر في كارت المنتج»), by product.
     *
     * @param  list<int>  $productIds
     * @return Collection<int, Collection<int, ProductSpecTable>>
     */
    private function state(array $productIds): Collection
    {
        if ($productIds === []) {
            return collect();
        }

        return ProductSpecTable::query()
            ->whereIn('product_id', $productIds)
            ->withCount(['rows as card_count' => fn (Builder $q) => $q->where('in_card', true)])
            ->get(['id', 'product_id', 'spec_group_id', 'position'])
            ->groupBy('product_id');
    }

    /** @return Builder<ProductSpecTable> the live products' copies of the group */
    private function linked(SpecGroup $group): Builder
    {
        return ProductSpecTable::query()->where('spec_group_id', $group->id)->whereHas('product');
    }

    /** @param list<array<string, mixed>> $rows */
    private function saveRows(SpecGroup $group, array $rows): void
    {
        $insert = [];
        foreach (array_values($rows) as $position => $row) {
            $insert[] = [
                'tenant_id' => $group->tenant_id,
                'spec_group_id' => $group->id,
                'label' => (string) $row['label'],
                'position' => $position,
                'in_card' => (bool) ($row['in_card'] ?? false),
                'filterable' => (bool) ($row['filterable'] ?? false),
            ];
        }
        if ($insert !== []) {
            SpecGroupRow::query()->insert($insert);
        }
        $group->unsetRelation('rows');
    }
}
