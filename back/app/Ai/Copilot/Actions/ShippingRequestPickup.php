<?php

declare(strict_types=1);

namespace App\Ai\Copilot\Actions;

use App\Ai\Copilot\Changes\ActionPreview;
use App\Ai\Copilot\Contracts\CopilotAction;
use App\Ai\Copilot\CopilotContext;
use App\Ai\Copilot\Support\CopilotToolError;
use App\Enums\ShipmentState;
use App\Models\CarrierAccount;
use App\Models\CopilotChangeItem;
use App\Models\CopilotChangeSet;
use App\Models\Shipment;
use App\Shipping\Carriers\Carriers;
use App\Shipping\ManageShipments;
use App\Support\CairoTime;
use Carbon\CarbonImmutable;

/** Asks a connected carrier to send a courier to the store's pickup location on a day. */
final class ShippingRequestPickup extends CopilotAction
{
    public function __construct(private readonly Carriers $carriers, private readonly ManageShipments $shipments) {}

    public function key(): string
    {
        return 'shipping.request_pickup';
    }

    public function label(): string
    {
        return 'طلب مندوب من شركة الشحن';
    }

    public function summary(): string
    {
        return 'Ask a connected carrier to send a courier to the store on a day (today … 14 days ahead, Cairo). parcels: default = shipments still waiting for the courier.';
    }

    public function available(CopilotContext $ctx): bool
    {
        return CarrierAccount::query()->exists();
    }

    public function schema(): array
    {
        return ['type' => 'object', 'properties' => [
            'carrier' => ['type' => 'string', 'enum' => $this->carriers->keys(), 'description' => 'Default: the only connected carrier.'],
            'date' => ['type' => 'string', 'description' => 'YYYY-MM-DD (Cairo).'],
            'parcels' => ['type' => 'integer', 'minimum' => 1, 'maximum' => 500],
            'notes' => ['type' => 'string', 'description' => '≤ 200 chars.'],
        ], 'required' => ['date']];
    }

    public function approval(): bool
    {
        return true;
    }

    public function reversible(): bool
    {
        return false;
    }

    public function columns(): array
    {
        return ['date' => ['اليوم', 'text'], 'parcels' => ['عدد الشحنات', 'int']];
    }

    public function preview(array $args, CopilotContext $ctx): ActionPreview
    {
        $accounts = CarrierAccount::query()->get();
        $account = isset($args['carrier']) ? $accounts->firstWhere('carrier', (string) $args['carrier']) : ($accounts->count() === 1 ? $accounts->first() : null);
        if ($account === null) {
            throw new CopilotToolError('Say which carrier: connected ones are '.($accounts->pluck('carrier')->implode(', ') ?: 'none').'.');
        }
        $today = CarbonImmutable::now(CairoTime::ZONE)->startOfDay();
        $date = preg_match('/^\d{4}-\d{2}-\d{2}$/', (string) ($args['date'] ?? '')) === 1 ? CarbonImmutable::parse((string) $args['date'], CairoTime::ZONE) : null;
        if ($date === null || $date->lt($today) || $date->gt($today->addDays(14))) {
            throw new CopilotToolError('date must be YYYY-MM-DD between today ('.$today->toDateString().') and 14 days ahead.');
        }
        $waiting = Shipment::query()->where('carrier_account_id', $account->id)->where('state', ShipmentState::Created)->count();
        $parcels = max(1, min(500, (int) ($args['parcels'] ?? $waiting)));
        $label = $this->carriers->get($account->carrier)->label();

        return new ActionPreview(
            summary: (string) __('ai.copilot.pickup_summary', ['carrier' => $label, 'date' => $date->toDateString()]),
            items: [[
                'entity_type' => 'carrier_accounts',
                'entity_id' => $account->id,
                'label' => $label,
                'before' => [],
                'after' => ['date' => $date->toDateString(), 'parcels' => $parcels],
                'status' => CopilotChangeItem::PENDING,
                'note' => null,
            ]],
            sideEffects: [],
            spec: ['notes' => mb_substr(trim((string) ($args['notes'] ?? '')), 0, 200)],
        );
    }

    public function apply(CopilotChangeItem $item, CopilotChangeSet $set, CopilotContext $ctx): void
    {
        $user = $ctx->user ?? throw new CopilotToolError('No user.');
        $notes = (string) ($set->spec['notes'] ?? '');
        $this->shipments->pickup(CarrierAccount::query()->findOrFail($item->entity_id), (string) $item->after['date'], (int) $item->after['parcels'], $notes !== '' ? $notes : null, $user);
    }
}
