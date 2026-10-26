<?php

declare(strict_types=1);

namespace App\Http\Resources;

use App\Models\DiscountCodeRedemption;
use App\Support\Money;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin DiscountCodeRedemption */
final class RedemptionResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'order_id' => $this->order_id,
            'phone' => $this->phone,
            'amount' => Money::toFloat(Money::toCents($this->amount)),
            'released_at' => $this->released_at?->toIso8601ZuluString(),
            'created_at' => $this->created_at?->toIso8601ZuluString(),
        ];
    }
}
