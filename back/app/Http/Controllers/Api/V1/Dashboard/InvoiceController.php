<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Dashboard;

use App\Billing\Payments\Checkout;
use App\Billing\Payments\Invoices;
use App\Billing\Payments\ManualPayments;
use App\Billing\Payments\OnlinePayments;
use App\Billing\Payments\PaymentGateways;
use App\Billing\Payments\ReceiptStore;
use App\Billing\Payments\Refunds;
use App\Billing\Payments\XPay\XPayError;
use App\Billing\PlatformSettings;
use App\Enums\InvoiceStatus;
use App\Http\Controllers\Concerns\RespondsWithJson;
use App\Http\Controllers\Controller;
use App\Http\Requests\Dashboard\CheckoutRequest;
use App\Http\Requests\Dashboard\PayInvoiceRequest;
use App\Http\Resources\InvoiceResource;
use App\Models\Invoice;
use App\Models\Payment;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * «الفواتير والدفع»: invoices for plan periods, manual transfers with a receipt, refund
 * requests. Open even on an expired plan (paying is how the store comes back).
 */
final class InvoiceController extends Controller
{
    use RespondsWithJson;

    public function __construct(
        private readonly Invoices $invoices,
        private readonly PaymentGateways $gateways,
        private readonly PlatformSettings $settings,
    ) {}

    public function index(Request $request, Refunds $refunds): JsonResponse
    {
        // A bill exists for the merchant once a receipt was sent (or it was paid / refunded).
        $page = Invoice::query()
            ->where(fn ($q) => $q->whereHas('payments')->orWhereIn('status', [InvoiceStatus::Paid->value, InvoiceStatus::Refunded->value]))
            ->with('payments.method:key,name')
            ->orderByDesc('id')
            ->paginate($this->perPage($request));

        return $this->paginated($page, InvoiceResource::class, [
            'refundable_invoice_id' => $refunds->refundableInvoice($this->tenant($request))?->id,
        ]);
    }

    /** The pay page: what would be paid and how. Nothing is saved (no invoice yet). */
    public function preview(CheckoutRequest $request, Checkout $checkout): JsonResponse
    {
        return $this->detail($checkout->preview($this->tenant($request), $request->item()));
    }

    /**
     * Sending the receipt: the invoice is created with it (or activated when nothing is due). An online method creates
     * the invoice and answers where to pay it (redirect_url).
     */
    public function checkout(CheckoutRequest $request, Checkout $checkout, OnlinePayments $online): JsonResponse
    {
        $method = $request->validated('method');
        $invoice = $checkout->place($this->tenant($request), $request->item(), $method, $request->senderRef(), $request->file('receipt'));
        $url = $online->isOnline($method) && $invoice->isPayable() && $invoice->totalCents() > 0 ? $online->begin($invoice, $online->method((string) $method)) : null;

        return $this->detail($invoice, 201, $url);
    }

    public function show(Invoice $invoice): JsonResponse
    {
        return $this->detail($invoice);
    }

    public function cancel(Invoice $invoice): JsonResponse
    {
        return $this->detail($this->invoices->cancel($invoice));
    }

    public function pay(PayInvoiceRequest $request, Invoice $invoice, ManualPayments $payments, OnlinePayments $online): JsonResponse
    {
        $method = (string) $request->validated('method');
        if ($request->online()) {
            return $this->detail($invoice, 200, $online->begin($invoice, $online->method($method)));
        }
        $payments->submit($invoice, $method, $request->senderRef(), $request->file('receipt'));

        return $this->detail($invoice->refresh(), 201);
    }

    /**
     * Back from the gateway's page (?session=…): the session is settled from the gateway itself (the webhook usually
     * did it already), so the page shows the invoice paid, waiting for a pay-later method, or still open.
     */
    public function online(Request $request, Invoice $invoice, OnlinePayments $online): JsonResponse
    {
        $data = $request->validate(['session' => ['required', 'string', 'max:100', 'regex:/^cs_(test|live)_[A-Za-z0-9]+$/']]);
        try {
            $row = $online->settle((string) $data['session'], $invoice);
        } catch (XPayError $e) {
            report($e);
            $row = null;
        }

        return $this->detail($invoice->refresh(), 200, null, $row?->status ?? 'unknown');
    }

    /** The merchant's own receipt (tenant-scoped bindings: other stores' ids are 404). */
    public function receipt(Invoice $invoice, Payment $payment, ReceiptStore $receipts): StreamedResponse
    {
        abort_if($payment->invoice_id !== $invoice->id, 404);

        return $receipts->response($payment->receipt_path);
    }

    public function refund(Request $request, Refunds $refunds): JsonResponse
    {
        $data = $request->validate(['reason' => ['required', 'string', 'min:3', 'max:500']]);
        $invoice = $refunds->request($this->tenant($request), trim(strip_tags($data['reason'])));

        return $this->detail($invoice);
    }

    /** The invoice with its payments, how it can be paid now, and the support contact. */
    private function detail(Invoice $invoice, int $status = 200, ?string $redirect = null, ?string $online = null): JsonResponse
    {
        if ($invoice->exists) {
            $invoice->load('payments.method:key,name');
        }
        $data = InvoiceResource::make($invoice)->resolve(request()) + ['pay_with' => $this->gateways->options($invoice)]
            + ($redirect === null ? [] : ['redirect_url' => $redirect])
            + ($online === null ? [] : ['online_status' => $online]);

        return $this->ok($data, ['support' => $this->settings->support()], $status);
    }

    private function tenant(Request $request): Tenant
    {
        /** @var User $user */
        $user = $request->user();

        return $user->tenant ?? abort(403);
    }
}
