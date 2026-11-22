<?php

declare(strict_types=1);

namespace App\Http\Resources;

use App\Models\CarrierAccount;
use App\Shipping\ConnectCarrier;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** A connected carrier account as the merchant sees it (never its key). @mixin CarrierAccount */
final class CarrierAccountResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'carrier' => $this->carrier,
            'mode' => $this->mode,
            'account_name' => $this->account_name,
            'status' => $this->status,
            'last_error' => $this->last_error,
            'checked_at' => $this->checked_at?->toIso8601ZuluString(),
            'settings' => array_intersect_key([...ConnectCarrier::DEFAULTS, ...($this->settings ?? [])], ConnectCarrier::DEFAULTS),
            'company' => $this->whenLoaded('company', fn () => $this->company === null ? null : ['id' => $this->company->id, 'name' => $this->company->name, 'is_active' => $this->company->is_active]),
            'open_shipments' => $this->shipments()->where('is_open', true)->count(),
        ];
    }
}
