<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Dashboard;

use App\Http\Controllers\Concerns\RespondsWithJson;
use App\Http\Controllers\Controller;
use App\Http\Requests\Dashboard\SpecGridRequest;
use App\Http\Requests\Dashboard\SpecGroupRequest;
use App\Models\SpecGroup;
use App\Models\SpecGroupRow;
use App\Rules\TenantExists;
use App\Store\Specs\SpecGroups;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

/** «مجموعات المواصفات» (docs/plans/tekno/PLAN.md §1.3). */
final class SpecGroupController extends Controller
{
    use RespondsWithJson;

    public function __construct(private readonly SpecGroups $groups) {}

    public function index(): JsonResponse
    {
        return $this->ok($this->groups->listQuery()->get()->map(fn (SpecGroup $g) => [
            'id' => $g->id,
            'name' => $g->name,
            'rows_count' => (int) $g->getAttribute('rows_count'),
            'products_count' => (int) $g->getAttribute('products_count'),
        ])->values()->all(), ['max' => SpecGroups::max()]);
    }

    public function store(SpecGroupRequest $request): JsonResponse
    {
        return $this->created($this->row($this->groups->create($request->validated())));
    }

    public function show(SpecGroup $specGroup): JsonResponse
    {
        return $this->ok($this->row($specGroup->load('rows')));
    }

    public function update(SpecGroupRequest $request, SpecGroup $specGroup): JsonResponse
    {
        return $this->ok($this->row($this->groups->update($specGroup, $request->validated())));
    }

    public function destroy(SpecGroup $specGroup): Response
    {
        $this->groups->delete($specGroup);

        return $this->noContent();
    }

    /** «أضف المجموعة لمنتجات»: products that already have it (or no room for another table) are skipped. */
    public function apply(Request $request, SpecGroup $specGroup): JsonResponse
    {
        $data = $request->validate([
            'product_ids' => ['required', 'array', 'min:1', 'max:500'],
            'product_ids.*' => ['integer', 'distinct', TenantExists::table('products')],
        ]);

        return $this->ok($this->groups->apply($specGroup, array_map('intval', $data['product_ids'])));
    }

    /** «ضيف التعديل للمنتجات اللي بتستخدمها». */
    public function push(SpecGroup $specGroup): JsonResponse
    {
        return $this->ok(['updated' => $this->groups->push($specGroup)]);
    }

    /** «املأ القيم»: the products using the group, 50 per page, with their values by label. */
    public function grid(Request $request, SpecGroup $specGroup): JsonResponse
    {
        $data = $request->validate(['page' => ['nullable', 'integer', 'min:1', 'max:10000']]);
        $specGroup->load('rows');
        $page = $this->groups->grid($specGroup, (int) ($data['page'] ?? 1));

        return $this->ok(
            $page->getCollection()->map(fn ($p) => $this->groups->gridRow($specGroup, $p))->values()->all(),
            [
                'labels' => $specGroup->rows->pluck('label')->values()->all(),
                'current_page' => $page->currentPage(),
                'last_page' => $page->lastPage(),
                'per_page' => $page->perPage(),
                'total' => $page->total(),
            ],
        );
    }

    public function saveGrid(SpecGridRequest $request, SpecGroup $specGroup): JsonResponse
    {
        /** @var list<array{product_id: int, values: list<array{label: string, value: string|null}>}> $rows */
        $rows = array_values($request->validated('rows'));

        return $this->ok(['updated' => $this->groups->saveGrid($specGroup, $rows)]);
    }

    /** @return array<string, mixed> */
    private function row(SpecGroup $group): array
    {
        return [
            'id' => $group->id,
            'name' => $group->name,
            'rows' => $group->rows->map(fn (SpecGroupRow $r) => ['label' => $r->label, 'in_card' => $r->in_card, 'filterable' => $r->filterable])->values()->all(),
            'products_count' => $group->tables()->whereHas('product')->count(),
        ];
    }
}
