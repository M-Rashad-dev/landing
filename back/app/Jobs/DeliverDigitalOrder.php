<?php

declare(strict_types=1);

namespace App\Jobs;

use App\Models\Order;
use App\Store\Digital\DigitalDeliveries;
use App\Tenancy\Tenancy;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

/** Delivers a confirmed order's digital lines (idempotent: a line delivered once is never delivered again). */
final class DeliverDigitalOrder implements ShouldQueue
{
    use Queueable;

    public int $tries = 3;

    public function __construct(public readonly int $tenantId, public readonly int $orderId) {}

    public function handle(DigitalDeliveries $deliveries): void
    {
        Tenancy::runAs($this->tenantId, function () use ($deliveries): void {
            $order = Order::query()->find($this->orderId);
            if ($order !== null) {
                $deliveries->deliver($order);
            }
        });
    }
}
