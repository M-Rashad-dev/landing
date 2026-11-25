<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Public;

use App\Enums\OrderStatus;
use App\Enums\StorePaymentKind;
use App\Exceptions\ApiException;
use App\Http\Controllers\Concerns\RespondsWithJson;
use App\Http\Controllers\Controller;
use App\Models\Identity;
use App\Models\Order;
use App\Models\OrderPayment;
use App\Models\StorePaymentMethod;
use App\Models\StorePaymentSetting;
use App\Orders\Refunds;
use App\Services\PublicPageData;
use App\Services\PublicSite;
use App\Store\Digital\DigitalDeliveries;
use App\Store\Payments\Gateways\GatewayError;
use App\Store\Payments\OnlineStorePayments;
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

    public function __construct(private readonly PublicSite $site, private readonly StorePayments $payments, private readonly PublicPageData $data, private readonly DigitalDeliveries $deliveries) {}

    /** The pay page; ?ref= (back from the gateway) settles that online checkout first, from the gateway itself. */
    public function show(Request $request, OnlineStorePayments $online): JsonResponse
    {
        $data = $request->validate([
            'host' => ['required', 'string', 'max:253'],
            'token' => ['required', 'string', 'regex:/^[a-z0-9]{12}$/'],
            'ref' => ['nullable', 'string', 'max:60', 'regex:/^[A-Za-z0-9]+$/'],
        ]);

        return $this->inOrder($data, function (Order $order) use ($data, $online): JsonResponse {
            if (isset($data['ref'])) {
                try {
                    $online->settle((string) $data['ref'], $order);
                } catch (GatewayError $e) {
                    report($e);
                }
            }

            return $this->ok($this->view($order->refresh(), (string) $data['host']));
        });
    }

    /** «ادفع أونلاين»: a checkout at the store's gateway for the order total; answers where to send the customer. */
    public function online(Request $request, OnlineStorePayments $online): JsonResponse
    {
        $data = $request->validate(['host' => ['required', 'string', 'max:253'], 'token' => ['required', 'string', 'regex:/^[a-z0-9]{12}$/'], 'method_id' => ['nullable', 'integer', 'min:1']]);

        return $this->inOrder($data, fn (Order $order) => $this->ok(['url' => $online->begin($order, isset($data['method_id']) ? (int) $data['method_id'] : null)]));
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
            // A receipt is for a transfer method; an online one is paid on its gateway.
            $method = StorePaymentMethod::query()->where('is_active', true)->where('kind', '!=', StorePaymentKind::Online->value)->find((int) $data['method_id'])
                ?? throw ValidationException::withMessages(['method_id' => [__('payments.unavailable')]]);
            $file = $request->file('receipt');
            $problem = StorePayments::receiptProblem($file);
            if ($problem !== null) {
                throw ValidationException::withMessages(['receipt' => [$problem]]);
            }
            $this->payments->submit($order, $method, $data['sender_ref'] ?? null, $file);

            return $this->created($this->view($order->refresh(), (string) $data['host']));
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
    private function view(Order $order, string $host): array
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
            'methods' => $waiting ? $this->payments->usableMethods()->map(fn (StorePaymentMethod $m) => $m->publicView())->values()->all() : [],
            // The latest online checkout (paid, waiting = kiosk reference not paid yet, open / failed / expired).
            'online' => app(OnlineStorePayments::class)->customerView($order),
            'receipts' => $receipts->map(fn (OrderPayment $p) => [
                'status' => $p->status,
                'method' => $p->method_name,
                'reject_reason' => $p->reject_reason,
                'created_at' => $p->created_at->toIso8601ZuluString(),
            ])->values()->all(),
            'can_send' => $waiting && ! $receipts->contains(fn (OrderPayment $p) => $p->status === OrderPayment::PENDING),
            'cancel_at' => $waiting ? $order->created_at->copy()->addDays(max(1, StorePaymentSetting::current()->cancel_after_days))->toIso8601ZuluString() : null,
            'store' => $identity === null ? null : $this->data->identity($identity),
            // Digital products bought: downloads, codes, the link, a service's message.
            'deliveries' => $this->deliveries->customerView($order, $this->site->primaryHost($order->tenant_id) ?? $host),
            'track_url' => rtrim(PublicSite::url((string) config('landing.platform_domain')), '/').'/t/'.$order->track_token,
            // Money the store sent back (or is sending back).
            'refunds' => app(Refunds::class)->customerView($order),
        ];
    }
}
