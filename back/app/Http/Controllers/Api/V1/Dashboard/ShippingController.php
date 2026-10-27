<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Dashboard;

use App\Http\Controllers\Concerns\RespondsWithJson;
use App\Http\Controllers\Controller;
use App\Jobs\RevalidateTenantHosts;
use App\Models\ShippingRate;
use App\Models\ShippingSetting;
use App\Support\Money;
use App\Tenancy\Tenancy;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

/** Store delivery fees: on/off, default fee, free-above threshold, and per-governorate fee / availability. */
final class ShippingController extends Controller
{
    use RespondsWithJson;

    public function show(): JsonResponse
    {
        return $this->ok($this->payload());
    }

    public function update(Request $request): JsonResponse
    {
        $governorates = (array) config('landing.governorates');
        $data = $request->validate([
            'enabled' => ['required', 'boolean'],
            'default_fee' => ['required', 'numeric', 'min:0', 'max:100000'],
            'free_over' => ['nullable', 'numeric', 'min:0', 'max:10000000'],
            'rates' => ['present', 'array', 'max:'.count($governorates)],
            'rates.*.governorate' => ['required', 'string', 'distinct', Rule::in($governorates)],
            'rates.*.fee' => ['nullable', 'numeric', 'min:0', 'max:100000'],
            'rates.*.is_available' => ['required', 'boolean'],
        ]);

        DB::transaction(function () use ($data): void {
            ShippingSetting::query()->updateOrCreate([], [
                'enabled' => (bool) $data['enabled'],
                'default_fee' => Money::toDecimal(Money::toCents((string) $data['default_fee'])),
                'free_over' => $data['free_over'] === null ? null : Money::toDecimal(Money::toCents((string) $data['free_over'])),
            ]);

            foreach ($data['rates'] as $rate) {
                $fee = $rate['fee'] === null ? null : Money::toDecimal(Money::toCents((string) $rate['fee']));
                // Rows equal to the default (default fee, available) are not stored.
                if ($fee === null && $rate['is_available']) {
                    ShippingRate::query()->where('governorate', $rate['governorate'])->delete();

                    continue;
                }
                ShippingRate::query()->updateOrCreate(['governorate' => $rate['governorate']], ['fee' => $fee, 'is_available' => (bool) $rate['is_available']]);
            }
        });

        // Public pages show the fees in the order form.
        RevalidateTenantHosts::dispatch((int) Tenancy::id())->afterCommit();

        return $this->ok($this->payload());
    }

    /** @return array<string, mixed> */
    private function payload(): array
    {
        $settings = ShippingSetting::query()->first();
        $rates = ShippingRate::query()->get()->keyBy('governorate');

        return [
            'enabled' => (bool) $settings?->enabled,
            'default_fee' => $settings === null ? 0.0 : Money::toFloat(Money::toCents((string) $settings->default_fee)),
            'free_over' => $settings?->free_over === null ? null : Money::toFloat(Money::toCents((string) $settings->free_over)),
            'rates' => array_map(function (string $governorate) use ($rates): array {
                /** @var ShippingRate|null $rate */
                $rate = $rates->get($governorate);

                return [
                    'governorate' => $governorate,
                    'fee' => $rate?->fee === null ? null : Money::toFloat(Money::toCents((string) $rate->fee)),
                    'is_available' => $rate === null ? true : $rate->is_available,
                ];
            }, array_values((array) config('landing.governorates'))),
        ];
    }
}
