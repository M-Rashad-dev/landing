<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Dashboard;

use App\Actions\Orders\PostOrderUpsell;
use App\Billing\Entitlements;
use App\Enums\PlanFeature;
use App\Http\Controllers\Concerns\RespondsWithJson;
use App\Http\Controllers\Controller;
use App\Models\Product;
use App\Models\Upsell;
use App\Rules\TenantExists;
use App\Support\Money;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Validation\ValidationException;

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

    public function store(Request $request): JsonResponse
    {
        app(Entitlements::class)->ensure(PlanFeature::Upsells);
        $upsell = Upsell::query()->create($this->validated($request));

        return $this->created($this->row($upsell->load(['triggerProduct', 'offerProduct'])));
    }

    public function update(Request $request, Upsell $upsell): JsonResponse
    {
        app(Entitlements::class)->ensure(PlanFeature::Upsells);
        $upsell->update($this->validated($request));

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
    private function validated(Request $request): array
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'min:2', 'max:120'],
            'trigger_product_id' => ['nullable', 'integer', TenantExists::table('products')->ignoreTrashed()],
            'offer_product_id' => ['required', 'integer', TenantExists::table('products')->ignoreTrashed()],
            'price' => ['required', 'numeric', 'min:1', 'max:1000000'],
            'headline' => ['required', 'string', 'min:2', 'max:150'],
            'description' => ['nullable', 'string', 'max:300'],
            'is_active' => ['sometimes', 'boolean'],
            'priority' => ['sometimes', 'integer', 'min:0', 'max:1000'],
        ]);

        if (($data['trigger_product_id'] ?? null) !== null && (int) $data['trigger_product_id'] === (int) $data['offer_product_id']) {
            throw ValidationException::withMessages(['offer_product_id' => [__('orders.upsell_same_product')]]);
        }
        if (! PostOrderUpsell::sellable(Product::query()->with('options')->find($data['offer_product_id']))) {
            throw ValidationException::withMessages(['offer_product_id' => [__('orders.upsell_product_options')]]);
        }

        $clean = fn (?string $value): ?string => $value === null ? null : (trim(strip_tags($value)) ?: null);

        return [
            'name' => (string) $clean($data['name']),
            'trigger_product_id' => $data['trigger_product_id'] ?? null,
            'offer_product_id' => (int) $data['offer_product_id'],
            'price' => Money::toDecimal(Money::toCents((string) $data['price'])),
            'headline' => (string) $clean($data['headline']),
            'description' => $clean($data['description'] ?? null),
            'is_active' => (bool) ($data['is_active'] ?? true),
            'priority' => (int) ($data['priority'] ?? 0),
        ];
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
