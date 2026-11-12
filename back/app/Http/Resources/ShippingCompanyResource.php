<?php

declare(strict_types=1);

namespace App\Http\Resources;

use App\Models\Media;
use App\Models\ShippingCompany;
use App\Models\ShippingCompanyRate;
use App\Support\Money;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin ShippingCompany */
final class ShippingCompanyResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        $rates = $this->rates->keyBy('governorate');
        $rows = array_map(function (string $governorate) use ($rates): array {
            /** @var ShippingCompanyRate|null $rate */
            $rate = $rates->get($governorate);

            return [
                'governorate' => $governorate,
                'fee' => $rate?->fee === null ? null : Money::toFloat(Money::toCents((string) $rate->fee)),
                'is_available' => $rate === null ? true : $rate->is_available,
            ];
        }, array_values((array) config('landing.governorates')));

        return [
            'id' => $this->id,
            'name' => $this->name,
            'media_id' => $this->media_id,
            'logo' => $this->logo instanceof Media ? $this->logo->urls() : null,
            'delivery_days_min' => $this->delivery_days_min,
            'delivery_days_max' => $this->delivery_days_max,
            'default_fee' => Money::toFloat($this->defaultFeeCents()),
            'is_active' => $this->is_active,
            'position' => $this->position,
            'served_count' => count(array_filter($rows, fn (array $r) => $r['is_available'])),
            'rates' => $rows,
            'created_at' => $this->created_at?->toIso8601ZuluString(),
            'updated_at' => $this->updated_at?->toIso8601ZuluString(),
        ];
    }
}
