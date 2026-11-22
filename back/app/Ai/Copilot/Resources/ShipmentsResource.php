<?php

declare(strict_types=1);

namespace App\Ai\Copilot\Resources;

use App\Ai\Copilot\Contracts\CopilotResource;
use App\Ai\Copilot\Contracts\Field;
use App\Enums\ShipmentState;
use App\Models\Shipment;
use Illuminate\Database\Eloquent\Model;

/** «الشحنات»: orders sent through a connected carrier (read only; shipping and cancelling are actions). */
final class ShipmentsResource extends CopilotResource
{
    public function key(): string
    {
        return 'shipments';
    }

    public function label(): string
    {
        return 'الشحنات';
    }

    public function summary(): string
    {
        return 'Shipments sent through a connected carrier (Bosta…): order number, tracking number, where it is (created = waiting for the courier, picked_up, in_transit, out_for_delivery, delivered, returning, returned, exception, cancelled, lost, damaged), the cash to collect, the carrier\'s problem reason and delivery attempts.';
    }

    public function model(): string
    {
        return Shipment::class;
    }

    public function fields(): array
    {
        $states = [];
        foreach (ShipmentState::cases() as $state) {
            $states[$state->value] = $state->label();
        }

        return [
            Field::text('order_number')->label('الطلب')->using(fn (Model $s) => '#'.($s->getRelation('order')?->getAttribute('order_number') ?? '')),
            Field::text('tracking_number')->label('رقم التتبع')->searchable(),
            Field::text('carrier')->label('الشركة')->filterable(),
            Field::enum('state', ShipmentState::class)->label('الحالة')->labels($states)->filterable(),
            Field::money('cod')->label('التحصيل')->sortable(),
            Field::text('exception')->label('المشكلة'),
            Field::int('attempts')->label('محاولات التوصيل')->sortable(),
            Field::date('created_at')->label('اتشحن')->filterable()->sortable(),
        ];
    }

    public function with(): array
    {
        return ['order:id,order_number'];
    }

    public function url(?Model $row): ?string
    {
        return $row instanceof Shipment ? '/dashboard/orders/'.$row->order_id : '/dashboard/orders';
    }
}
