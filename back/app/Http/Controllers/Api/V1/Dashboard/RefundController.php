<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Dashboard;

use App\Enums\RefundStatus;
use App\Exceptions\ApiException;
use App\Http\Controllers\Concerns\RespondsWithJson;
use App\Http\Controllers\Controller;
use App\Http\Requests\Dashboard\RefundRequest;
use App\Models\Order;
use App\Models\OrderRefund;
use App\Models\User;
use App\Orders\Refunds;
use App\Store\Payments\StorePayments;
use App\Support\Money;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

/**
 * «المرتجعات والمبالغ المسترجعة»: the refunds list (pending first), «رد مبلغ» on an order, «اترجّع» with a reference /
 * proof, cancelling one asked by mistake, and its proof file.
 */
final class RefundController extends Controller
{
    use RespondsWithJson;

    public function __construct(private readonly Refunds $refunds) {}

    public function index(Request $request): JsonResponse
    {
        $data = $request->validate(['status' => ['nullable', Rule::in([...RefundStatus::values(), 'all'])]]);
        $status = $data['status'] ?? RefundStatus::Pending->value;

        $page = OrderRefund::query()
            ->with(['order.items', 'creator:id,name', 'doer:id,name'])
            ->when($status !== 'all', fn ($q) => $q->where('status', $status))
            ->orderByDesc('id')
            ->paginate($this->perPage($request));
        $pending = OrderRefund::query()->where('status', RefundStatus::Pending);

        return $this->ok(
            $page->getCollection()->map(fn (OrderRefund $r) => $this->refunds->view($r, $r->order))->values()->all(),
            [
                'current_page' => $page->currentPage(),
                'last_page' => $page->lastPage(),
                'per_page' => $page->perPage(),
                'total' => $page->total(),
                'pending_count' => (clone $pending)->count(),
                'pending_total' => Money::toFloat(Money::toCents((string) (clone $pending)->sum('amount'))),
            ],
        );
    }

    public function store(RefundRequest $request, Order $order): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $refund = $this->refunds->request($order, $request->values(), $user, $request->proof());

        return $this->created($this->refunds->view($refund->refresh(), $order->refresh()));
    }

    public function complete(Request $request, OrderRefund $refund): JsonResponse
    {
        $data = $request->validate([
            'reference' => ['nullable', 'string', 'max:120'],
            'proof' => ['nullable', 'file', 'max:'.StorePayments::RECEIPT_MAX_KB],
        ]);
        $proof = $request->file('proof');
        $proof = $proof instanceof UploadedFile ? $proof : null;
        if ($proof !== null && ($problem = StorePayments::receiptProblem($proof)) !== null) {
            throw ValidationException::withMessages(['proof' => [$problem]]);
        }
        /** @var User $user */
        $user = $request->user();
        $done = $this->refunds->complete($refund, $data['reference'] ?? null, $proof, $user);

        return $this->ok($this->refunds->view($done, Order::query()->findOrFail($done->order_id)));
    }

    public function cancel(Request $request, OrderRefund $refund): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $cancelled = $this->refunds->cancel($refund, $user);

        return $this->ok($this->refunds->view($cancelled, Order::query()->findOrFail($cancelled->order_id)));
    }

    public function proof(OrderRefund $refund): BinaryFileResponse
    {
        $path = $this->refunds->proofPath($refund) ?? throw new ApiException(404, 'not_found', __('landing.not_found'));

        return response()->file($path, [
            'Content-Type' => (string) $refund->proof_mime,
            'Cache-Control' => 'private, no-store',
            'X-Content-Type-Options' => 'nosniff',
            'Content-Security-Policy' => "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'",
        ]);
    }
}
