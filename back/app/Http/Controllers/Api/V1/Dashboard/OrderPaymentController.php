<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Dashboard;

use App\Http\Controllers\Concerns\RespondsWithJson;
use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\OrderPayment;
use App\Models\User;
use App\Store\Payments\StorePayments;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

/** A prepaid order's receipts: see one, accept it (the order is confirmed) or refuse it with a reason. */
final class OrderPaymentController extends Controller
{
    use RespondsWithJson;

    public function __construct(private readonly StorePayments $payments) {}

    public function receipt(Order $order, int $payment): BinaryFileResponse
    {
        $row = $this->find($order, $payment);

        return response()->file($this->payments->receiptPath($row), [
            'Content-Type' => $row->receipt_mime,
            'Cache-Control' => 'private, no-store',
            'X-Content-Type-Options' => 'nosniff',
            'Content-Security-Policy' => "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'",
        ]);
    }

    public function approve(Request $request, Order $order, int $payment): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $updated = $this->payments->approve($this->find($order, $payment), $user);

        return $this->ok(['status' => $updated->status->value, 'payment_status' => $updated->payment_status?->value]);
    }

    public function reject(Request $request, Order $order, int $payment): JsonResponse
    {
        $data = $request->validate(['reason' => ['required', 'string', 'min:3', 'max:300']]);
        /** @var User $user */
        $user = $request->user();
        $updated = $this->payments->reject($this->find($order, $payment), (string) $data['reason'], $user);

        return $this->ok(['status' => $updated->status->value, 'payment_status' => $updated->payment_status?->value]);
    }

    private function find(Order $order, int $payment): OrderPayment
    {
        return OrderPayment::query()->where('order_id', $order->id)->findOrFail($payment);
    }
}
