<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Dashboard;

use App\Enums\DeliveryType;
use App\Exceptions\ApiException;
use App\Http\Controllers\Concerns\RespondsWithJson;
use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\OrderDelivery;
use App\Store\Digital\DigitalDeliveries;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** A digital order line's delivery: send it again, give more downloads / opens, or «تم التنفيذ» for a service. */
final class OrderDeliveryController extends Controller
{
    use RespondsWithJson;

    public function __construct(private readonly DigitalDeliveries $deliveries) {}

    public function resend(Order $order, int $delivery): JsonResponse
    {
        $this->deliveries->resend($this->find($order, $delivery));

        return $this->ok(['sent' => true]);
    }

    public function grant(Request $request, Order $order, int $delivery): JsonResponse
    {
        $data = $request->validate(['count' => ['required', 'integer', 'between:1,100']]);
        $row = $this->deliveries->grant($this->find($order, $delivery), (int) $data['count']);

        return $this->ok(['bonus' => $row->bonus]);
    }

    public function complete(Request $request, Order $order, int $delivery): JsonResponse
    {
        $data = $request->validate([
            'subject' => ['required', 'string', 'max:150'],
            'message' => ['required', 'string', 'min:2', 'max:3000'],
        ]);
        $row = $this->find($order, $delivery);
        if ($row->type !== DeliveryType::Services) {
            throw new ApiException(422, 'not_service', __('digital.not_service'));
        }
        $this->deliveries->completeService($row, (string) $data['subject'], (string) $data['message']);

        return $this->ok(['status' => $row->refresh()->status]);
    }

    private function find(Order $order, int $id): OrderDelivery
    {
        return OrderDelivery::query()->where('order_id', $order->id)->findOrFail($id);
    }
}
