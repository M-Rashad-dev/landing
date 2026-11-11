<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Dashboard;

use App\Billing\Payments\Checkout;
use App\Billing\Payments\Invoices;
use App\Billing\Payments\ManualPayments;
use App\Billing\Payments\PaymentGateways;
use App\Billing\Payments\ReceiptStore;
use App\Billing\Payments\Refunds;
use App\Billing\PlatformSettings;
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
        $page = Invoice::query()->with('payments.method:key,name')->orderByDesc('id')->paginate($this->perPage($request));

        return $this->paginated($page, InvoiceResource::class, [
            'refundable_invoice_id' => $refunds->refundableInvoice($this->tenant($request))?->id,
        ]);
    }

    /** The pay page: what would be paid and how. Nothing is saved (no invoice yet). */
    public function preview(CheckoutRequest $request, Checkout $checkout): JsonResponse
    {
        return $this->detail($checkout->preview($this->tenant($request), $request->item()));
    }

    /** Sending the receipt: the invoice is created with it (or activated when nothing is due). */
    public function checkout(CheckoutRequest $request, Checkout $checkout): JsonResponse
    {
        $invoice = $checkout->place($this->tenant($request), $request->item(), $request->validated('method'), $request->senderRef(), $request->file('receipt'));

        return $this->detail($invoice, 201);
    }

    public function show(Invoice $invoice): JsonResponse
    {
        return $this->detail($invoice);
    }

    public function cancel(Invoice $invoice): JsonResponse
    {
        return $this->detail($this->invoices->cancel($invoice));
    }

    public function pay(PayInvoiceRequest $request, Invoice $invoice, ManualPayments $payments): JsonResponse
    {
        $payments->submit($invoice, (string) $request->validated('method'), $request->senderRef(), $request->file('receipt'));

        return $this->detail($invoice->refresh(), 201);
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
    private function detail(Invoice $invoice, int $status = 200): JsonResponse
    {
        if ($invoice->exists) {
            $invoice->load('payments.method:key,name');
        }
        $data = InvoiceResource::make($invoice)->resolve(request()) + ['pay_with' => $this->gateways->options($invoice)];

        return $this->ok($data, ['support' => $this->settings->support()], $status);
    }

    private function tenant(Request $request): Tenant
    {
        /** @var User $user */
        $user = $request->user();

        return $user->tenant ?? abort(403);
    }
}
