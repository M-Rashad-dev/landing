<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Dashboard;

use App\Billing\Entitlements;
use App\Enums\PlanFeature;
use App\Http\Controllers\Concerns\RespondsWithJson;
use App\Http\Controllers\Controller;
use App\Http\Requests\Dashboard\UpsellRequest;
use App\Models\Upsell;
use App\Support\Money;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Response;

/** Post-order offers (success screen): list with acceptance stats, create, edit, toggle, delete. */
final class UpsellController extends Controller
{
    use RespondsWithJson;

    public function index(): JsonResponse
    {
        $upsells = Upsell::query()
            ->with(['triggerProduct:id,name,deleted_at', 'offerProduct:id,name,price,deleted_at'])
            ->withCount('orderItems as accepted_count')
            ->withSum('orderItems as accepted_revenue', 'line_total')
            ->orderByDesc('is_active')
            ->orderByDesc('priority')
            ->orderByDesc('id')
            ->get();

        return $this->ok($upsells->map(fn (Upsell $upsell) => $this->row($upsell))->values()->all());
    }

    public function store(UpsellRequest $request): JsonResponse
    {
        app(Entitlements::class)->ensure(PlanFeature::Upsells);
        $upsell = Upsell::query()->create($request->upsellData());

        return $this->created($this->row($upsell->load(['triggerProduct', 'offerProduct'])));
    }

    public function update(UpsellRequest $request, Upsell $upsell): JsonResponse
    {
        app(Entitlements::class)->ensure(PlanFeature::Upsells);
        $upsell->update($request->upsellData());

        return $this->ok($this->row($upsell->load(['triggerProduct', 'offerProduct'])));
    }

    public function toggle(Upsell $upsell): JsonResponse
    {
        // Turning an offer off is always allowed.
        if (! $upsell->is_active) {
            app(Entitlements::class)->ensure(PlanFeature::Upsells);
        }
        $upsell->update(['is_active' => ! $upsell->is_active]);

        return $this->ok($this->row($upsell->load(['triggerProduct', 'offerProduct'])));
    }

    public function destroy(Upsell $upsell): Response
    {
        $upsell->delete();

        return $this->noContent();
    }

    /** @return array<string, mixed> */
    private function row(Upsell $upsell): array
    {
        return [
            'id' => $upsell->id,
            'name' => $upsell->name,
            'trigger_product' => $upsell->triggerProduct === null ? null : ['id' => $upsell->triggerProduct->id, 'name' => $upsell->triggerProduct->name],
            'offer_product' => ['id' => $upsell->offerProduct->id, 'name' => $upsell->offerProduct->name, 'price' => Money::toFloat($upsell->offerProduct->priceCents())],
            'price' => Money::toFloat($upsell->priceCents()),
            'headline' => $upsell->headline,
            'description' => $upsell->description,
            'is_active' => $upsell->is_active,
            'priority' => $upsell->priority,
            'accepted_count' => (int) ($upsell->getAttribute('accepted_count') ?? 0),
            'accepted_revenue' => Money::toFloat(Money::toCents((string) ($upsell->getAttribute('accepted_revenue') ?? '0'))),
            'created_at' => $upsell->created_at?->toIso8601ZuluString(),
        ];
    }
}
