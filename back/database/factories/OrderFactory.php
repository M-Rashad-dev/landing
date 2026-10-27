<?php

declare(strict_types=1);

namespace Database\Factories;

use App\Enums\OrderStatus;
use App\Models\Order;
use App\Models\Tenant;
use App\Tenancy\Tenancy;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<Order> */
class OrderFactory extends Factory
{
    protected $model = Order::class;

    private static int $number = 1000;

    /** @return array<string, mixed> */
    public function definition(): array
    {
        return [
            // Inside Tenancy::runAs() rows belong to the current tenant.
            'tenant_id' => fn () => Tenancy::id() ?? Tenant::factory()->create()->id,
            'order_number' => ++self::$number,
            'status' => OrderStatus::New,
            'status_changed_at' => now(),
            'customer_name' => 'عميل تجريبي',
            'customer_phone' => '+2010'.fake()->numerify('########'),
            'governorate' => 'القاهرة',
            'address' => 'شارع التحرير',
            'quantity' => 1,
            'unit_price' => '350.00',
            'subtotal' => '350.00',
            'offer_discount' => '0.00',
            'code_discount' => '0.00',
            'total' => '350.00',
            'currency' => 'EGP',
            'ip_address' => '10.0.0.1',
        ];
    }

    public function status(OrderStatus $status): static
    {
        return $this->state(fn () => ['status' => $status]);
    }
}
