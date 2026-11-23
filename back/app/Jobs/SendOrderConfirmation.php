<?php

declare(strict_types=1);

namespace App\Jobs;

use App\Models\Order;
use App\Notifications\CustomerNotices;
use App\Orders\WhatsAppConfirmations;
use App\Tenancy\Tenancy;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

/** Sends a new order's WhatsApp confirmation (after the store's delay); when it can't go, the usual «received» goes. */
final class SendOrderConfirmation implements ShouldQueue
{
    use Queueable;

    public int $tries = 1;

    public function __construct(public readonly int $tenantId, public readonly int $orderId) {}

    public function handle(WhatsAppConfirmations $confirmations): void
    {
        Tenancy::runAs($this->tenantId, function () use ($confirmations): void {
            $order = Order::query()->find($this->orderId);
            if ($order === null || ! $confirmations->eligible($order)) {
                return;
            }
            if (! $confirmations->send($order)) {
                DeliverCustomerNotice::dispatch($this->tenantId, $this->orderId, CustomerNotices::RECEIVED);
            }
        });
    }
}
