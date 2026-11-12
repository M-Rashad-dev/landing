<?php

declare(strict_types=1);

namespace App\Actions\Orders;

use App\Models\Customer;
use App\Models\Order;

/**
 * Keeps the store's customer list in step with orders: the order's phone is the customer,
 * whose details become the latest order's. Called inside the order transaction.
 */
final class LinkCustomer
{
    public function handle(Order $order): Customer
    {
        $customer = Customer::query()->createOrFirst(['phone' => $order->customer_phone], [
            'first_order_at' => $order->created_at,
        ]);

        $customer->fill(array_filter([
            'name' => $order->customer_name,
            'email' => $order->customer_email,
            'governorate' => $order->governorate,
            'city' => $order->city,
            'address' => $order->address,
        ], fn ($value) => $value !== null && $value !== ''));
        if ($customer->last_order_at === null || $order->created_at->greaterThan($customer->last_order_at)) {
            $customer->last_order_at = $order->created_at;
        }
        if ($customer->first_order_at === null || $order->created_at->lessThan($customer->first_order_at)) {
            $customer->first_order_at = $order->created_at;
        }
        $customer->save();

        if ($order->customer_id !== $customer->id) {
            $order->forceFill(['customer_id' => $customer->id])->save();
        }

        return $customer;
    }
}
