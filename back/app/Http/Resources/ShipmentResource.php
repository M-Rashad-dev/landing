<?php

declare(strict_types=1);

namespace App\Http\Resources;

use App\Enums\ShipmentState;
use App\Models\Shipment;
use App\Models\ShipmentEvent;
use App\Shipping\Carriers\Carriers;
use App\Support\Money;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin Shipment */
final class ShipmentResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        $carriers = app(Carriers::class);

        return [
            'id' => $this->id,
            'order_id' => $this->order_id,
            'carrier' => $this->carrier,
            'carrier_name' => $carriers->has($this->carrier) ? $carriers->get($this->carrier)->label() : $this->carrier,
            'connected' => $this->carrier_account_id !== null,
            'tracking_number' => $this->tracking_number,
            'state' => $this->state->value,
            'state_label' => $this->state->label(),
            'carrier_label' => $this->carrier_label,
            'cod' => Money::toFloat($this->codCents()),
            'exception' => $this->exception,
            'attempts' => $this->attempts,
            'is_open' => $this->is_open,
            'can_cancel' => $this->is_open && $this->state === ShipmentState::Created && $this->carrier_account_id !== null,
            'synced_at' => $this->synced_at?->toIso8601ZuluString(),
            'created_at' => $this->created_at?->toIso8601ZuluString(),
            'events' => $this->whenLoaded('events', fn () => $this->events->map(fn (ShipmentEvent $e) => [
                'state' => $e->state->value,
                'state_label' => $e->state->label(),
                'carrier_label' => $e->label,
                'note' => $e->note,
                'at' => $e->happened_at->toIso8601ZuluString(),
            ])->values()->all()),
        ];
    }
}
