<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Exceptions\ApiException;
use App\Models\Shipment;
use App\Shipping\ManageShipments;
use App\Tenancy\Tenancy;
use Illuminate\Console\Command;

/**
 * Asks the carriers about open shipments nobody heard of lately (a webhook lost, or a dev box carriers can't reach),
 * oldest first, a batch per run.
 */
final class SyncShipments extends Command
{
    protected $signature = 'shipments:sync {--limit=200}';

    protected $description = 'Refresh open shipments from their carriers when no update came for a while';

    public function handle(ManageShipments $shipments): int
    {
        $before = now()->subMinutes((int) config('shipping.sync_after_minutes', 120));
        // Audited bypass: lists open shipments of every store (id + tenant only); each is refreshed inside its tenant.
        $due = Tenancy::withoutTenant(fn () => Shipment::query()
            ->where('is_open', true)->whereNotNull('carrier_account_id')
            ->where(fn ($q) => $q->whereNull('synced_at')->orWhere('synced_at', '<', $before))
            ->orderBy('synced_at')->limit((int) $this->option('limit'))
            ->get(['id', 'tenant_id']));

        $done = 0;
        foreach ($due as $row) {
            Tenancy::runAs((int) $row->tenant_id, function () use ($row, $shipments, &$done): void {
                $shipment = Shipment::query()->find($row->id);
                if ($shipment === null) {
                    return;
                }
                try {
                    $shipments->refresh($shipment);
                    $done++;
                } catch (ApiException) {
                    // The carrier refused or is down: try again next run (a dead key marks the account failed).
                    $shipment->forceFill(['synced_at' => now()])->save();
                }
            });
        }
        $this->info("Refreshed {$done} of {$due->count()} shipments.");

        return self::SUCCESS;
    }
}
