<?php

declare(strict_types=1);

namespace App\Jobs;

use App\Enums\OrderStatus;
use App\Exceptions\ApiException;
use App\Models\CarrierAccount;
use App\Models\Order;
use App\Models\ShippingCompany;
use App\Notifications\StoreNotices;
use App\Shipping\Carriers\Carriers;
use App\Shipping\ShipOrder;
use App\Tenancy\Tenancy;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;

/**
 * Ships an order as soon as it is confirmed, when its shipping company is linked to a carrier account set to ship
 * by itself. A refusal (unknown area, carrier down…) goes to the merchant's bell; the order stays confirmed.
 */
final class AutoShipOrder implements ShouldQueue
{
    use Dispatchable;
    use Queueable;

    public int $tries = 1;

    public function __construct(public readonly int $tenantId, public readonly int $orderId) {}

    public function handle(ShipOrder $ship, StoreNotices $notices, Carriers $carriers): void
    {
        Tenancy::runAs($this->tenantId, function () use ($ship, $notices, $carriers): void {
            $order = Order::query()->find($this->orderId);
            if ($order === null || $order->status !== OrderStatus::Confirmed || $order->shipping_company_id === null) {
                return;
            }
            $accountId = ShippingCompany::query()->whereKey($order->shipping_company_id)->value('carrier_account_id');
            $account = $accountId === null ? null : CarrierAccount::query()->find($accountId);
            if ($account === null || ! $account->isActive() || ! (bool) $account->setting('auto_ship', false)) {
                return;
            }
            try {
                $ship->handle($order, $account, [], null);
            } catch (ApiException $e) {
                if ($e->errorCode !== 'ship_exists') {
                    $notices->shipmentFailed($order, $carriers->get($account->carrier)->label(), $e->getMessage());
                }
            }
        });
    }
}
