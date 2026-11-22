<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Public;

use App\Enums\OrderStatus;
use App\Exceptions\ApiException;
use App\Http\Controllers\Concerns\RespondsWithJson;
use App\Http\Controllers\Controller;
use App\Models\Identity;
use App\Models\Order;
use App\Models\OrderPayment;
use App\Models\StorePaymentMethod;
use App\Models\StorePaymentSetting;
use App\Services\PublicPageData;
use App\Services\PublicSite;
use App\Store\Payments\StorePayments;
use App\Support\Money;
use App\Tenancy\Tenancy;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

/**
 * The pay page (https://{store}/pay/{token}): a prepaid order's total, where to send the money, and the receipt
 * upload. The private token in the order messages is the only key; nothing about the customer comes back.
 */
final class PaymentController extends Controller
{
    use RespondsWithJson;

    public function __construct(private readonly PublicSite $site, private readonly StorePayments $payments, private readonly PublicPageData $data) {}

    public function show(Request $request): JsonResponse
    {
        $data = $request->validate(['host' => ['required', 'string', 'max:253'], 'token' => ['required', 'string', 'regex:/^[a-z0-9]{12}$/']]);

        return $this->inOrder($data, fn (Order $order) => $this->ok($this->view($order)));
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'host' => ['required', 'string', 'max:253'],
            'token' => ['required', 'string', 'regex:/^[a-z0-9]{12}$/'],
            'method_id' => ['required', 'integer', 'min:1'],
            'sender_ref' => ['nullable', 'string', 'max:80'],
            'receipt' => ['required', 'file', 'max:'.StorePayments::RECEIPT_MAX_KB],
            'ip' => ['nullable', 'ip'],
        ]);

        return $this->inOrder($data, function (Order $order) use ($request, $data): JsonResponse {
            $method = StorePaymentMethod::query()->where('is_active', true)->find((int) $data['method_id'])
                ?? throw ValidationException::withMessages(['method_id' => [__('payments.unavailable')]]);
            $file = $request->file('receipt');
            $problem = StorePayments::receiptProblem($file);
            if ($problem !== null) {
                throw ValidationException::withMessages(['receipt' => [$problem]]);
            }
            $this->payments->submit($order, $method, $data['sender_ref'] ?? null, $file);

            return $this->created($this->view($order->refresh()));
        });
    }

    /** @param array<string, mixed> $data */
    private function inOrder(array $data, \Closure $then): JsonResponse
    {
        $domain = $this->site->activeDomainOrFail((string) $data['host']);

        return Tenancy::runAs($domain->tenant_id, function () use ($data, $then): JsonResponse {
            $order = Order::query()->where('track_token', $data['token'])->where('payment_method', Order::PREPAID)->first()
                ?? throw new ApiException(404, 'order_not_found', __('orders.track_not_found'));

            return $then($order)->header('Cache-Control', 'no-store, private');
        });
    }

    /** @return array<string, mixed> */
    private function view(Order $order): array
    {
        $identity = Identity::query()->orderByDesc('is_default')->orderBy('id')->first();
        $receipts = $order->payments()->get();
        $waiting = $order->status === OrderStatus::AwaitingPayment;

        return [
            'order_number' => $order->order_number,
            'total' => Money::toFloat(Money::toCents((string) $order->total)),
            'status' => $waiting ? 'awaiting' : ($order->status->isDismissed() ? 'cancelled' : 'paid'),
            'payment_status' => $order->payment_status?->value,
            'chosen_method_id' => $order->store_payment_method_id,
            'methods' => $waiting ? StorePaymentMethod::query()->where('is_active', true)->orderBy('position')->orderBy('id')->get()->map(fn (StorePaymentMethod $m) => $m->publicView())->values()->all() : [],
            'receipts' => $receipts->map(fn (OrderPayment $p) => [
                'status' => $p->status,
                'method' => $p->method_name,
                'reject_reason' => $p->reject_reason,
                'created_at' => $p->created_at->toIso8601ZuluString(),
            ])->values()->all(),
            'can_send' => $waiting && ! $receipts->contains(fn (OrderPayment $p) => $p->status === OrderPayment::PENDING),
            'cancel_at' => $waiting ? $order->created_at->copy()->addDays(max(1, StorePaymentSetting::current()->cancel_after_days))->toIso8601ZuluString() : null,
            'store' => $identity === null ? null : $this->data->identity($identity),
            'track_url' => rtrim(PublicSite::url((string) config('landing.platform_domain')), '/').'/t/'.$order->track_token,
        ];
    }
}
