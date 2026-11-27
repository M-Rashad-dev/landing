<?php

declare(strict_types=1);

namespace App\Ai\Copilot\Resources;

use App\Ai\Copilot\Contracts\CopilotResource;
use App\Ai\Copilot\Contracts\Field;
use App\Ai\Copilot\CopilotContext;
use App\Http\Requests\Dashboard\SpecGroupRequest;
use App\Models\SpecGroup;
use App\Models\SpecGroupRow;
use App\Store\Specs\ProductSpecs;
use App\Store\Specs\SpecGroups;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Foundation\Http\FormRequest;

/**
 * «مجموعات المواصفات» (docs/plans/tekno/PLAN.md §1.6): reusable spec tables (a name + row labels). Its rows are a text
 * of labels separated by «،» so the copilot edits them like any text (a label kept keeps its flags); new groups are
 * made with the action spec_groups.create. Products keep their own copies: editing a group changes no product.
 */
final class SpecGroupsResource extends CopilotResource
{
    public function key(): string
    {
        return 'spec_groups';
    }

    public function label(): string
    {
        return 'مجموعات المواصفات';
    }

    public function summary(): string
    {
        return 'Spec groups: a named table of row labels («لابتوب»: المعالج، الرامات، التخزين…) the merchant adds to products; each product gets its own copy and fills the values. rows = labels separated by «،» (editable: set / append / replace). in_card rows show on product cards (max 4), filterable rows become category filters. Create new groups with the action spec_groups.create.';
    }

    public function available(CopilotContext $ctx): bool
    {
        return $ctx->hasStore();
    }

    public function model(): string
    {
        return SpecGroup::class;
    }

    public function query(CopilotContext $ctx): Builder
    {
        return app(SpecGroups::class)->listQuery();
    }

    public function fields(): array
    {
        return [
            Field::text('name')->label('الاسم')->searchable()->sortable()->editable(),
            Field::text('rows')->label('الصفوف')->editable()
                ->using(fn (Model $g) => $g instanceof SpecGroup ? $g->rows->pluck('label')->implode('، ') : null),
            Field::text('card_rows')->label('تظهر في الكارت')->notInTable()
                ->using(fn (Model $g) => $g instanceof SpecGroup ? $g->rows->where('in_card', true)->pluck('label')->all() : []),
            Field::text('filter_rows')->label('فلاتر')->notInTable()
                ->using(fn (Model $g) => $g instanceof SpecGroup ? $g->rows->where('filterable', true)->pluck('label')->all() : []),
            Field::int('rows_count')->label('عدد الصفوف')->using(fn (Model $g) => (int) $g->getAttribute('rows_count')),
            Field::int('products_count')->label('المنتجات')->using(fn (Model $g) => (int) $g->getAttribute('products_count')),
        ];
    }

    public function with(): array
    {
        return ['rows'];
    }

    public function request(): ?string
    {
        return SpecGroupRequest::class;
    }

    public function routeParameter(): string
    {
        return 'specGroup';
    }

    /** The full request (rows replace the old ones): its current name and rows with their flags. */
    public function body(Model $row): array
    {
        return [
            'name' => $row->getAttribute('name'),
            'rows' => $row instanceof SpecGroup ? $row->rows->map(fn (SpecGroupRow $r) => ['label' => $r->label, 'in_card' => $r->in_card, 'filterable' => $r->filterable])->values()->all() : [],
        ];
    }

    /** `rows` text → rows (a label already in the group keeps its flags; new ones start without). */
    public function requestData(array $after, Model $row): array
    {
        $after = parent::requestData($after, $row);
        if (array_key_exists('rows', $after) && $row instanceof SpecGroup) {
            $old = $row->rows->keyBy(fn (SpecGroupRow $r) => ProductSpecs::key($r->label));
            $labels = array_values(array_unique(array_filter(array_map('trim', preg_split('/[،,\n]+/u', (string) $after['rows']) ?: []), fn (string $l) => $l !== '')));
            $after['rows'] = array_map(fn (string $label) => [
                'label' => $label,
                'in_card' => (bool) $old->get(ProductSpecs::key($label))?->in_card,
                'filterable' => (bool) $old->get(ProductSpecs::key($label))?->filterable,
            ], $labels);
        }

        return $after;
    }

    public function persist(FormRequest $validated, ?Model $row): Model
    {
        $groups = app(SpecGroups::class);

        return $row instanceof SpecGroup ? $groups->update($row, $validated->validated()) : $groups->create($validated->validated());
    }

    public function url(?Model $row): ?string
    {
        return $row === null ? '/dashboard/catalog/spec-groups' : "/dashboard/catalog/spec-groups/{$row->getKey()}";
    }
}
