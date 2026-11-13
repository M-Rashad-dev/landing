<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Admin;

use App\Actions\Admin\ManageTenant;
use App\Billing\Payments\ManualGateway;
use App\Billing\Payments\ManualPayments;
use App\Billing\Payments\ReceiptStore;
use App\Billing\Payments\Refunds;
use App\Enums\InvoiceStatus;
use App\Enums\PaymentStatus;
use App\Http\Controllers\Concerns\RespondsWithJson;
use App\Http\Controllers\Controller;
use App\Models\Invoice;
use App\Models\Payment;
use App\Models\PaymentMethod;
use App\Support\CairoTime;
use App\Support\Money;
use App\Tenancy\Tenancy;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * «المدفوعات» in the admin: receipts to review, refunds to send, payment methods.
 * Audited bypass: the super admin has no tenant, so payments / invoices of every store are
 * read inside Tenancy::withoutTenant(), always by id or by an explicit filter.
 */
final class PaymentController extends Controller
{
    use RespondsWithJson;

    public function index(Request $request): JsonResponse
    {
        $request->validate([
            'status' => ['nullable', Rule::in(['pending_review', 'approved', 'rejected', 'all'])],
            'q' => ['nullable', 'string', 'max:100'],
            'method' => ['nullable', 'string', Rule::exists('payment_methods', 'key')],
            'from' => ['nullable', 'date_format:Y-m-d'],
            'to' => ['nullable', 'date_format:Y-m-d', 'after_or_equal:from'],
        ]);
        $status = (string) $request->query('status', 'pending_review');
        $search = trim((string) $request->query('q', ''));
        $method = (string) $request->query('method', '');
        $from = $request->query('from') ? CarbonImmutable::parse((string) $request->query('from'), CairoTime::ZONE)->startOfDay()->utc() : null;
        $to = $request->query('to') ? CarbonImmutable::parse((string) $request->query('to'), CairoTime::ZONE)->addDay()->startOfDay()->utc() : null;

        $page = Tenancy::withoutTenant(fn () => Payment::query()
            ->with(['invoice', 'tenant:id,name', 'method:key,name'])
            ->when($status !== 'all', fn (Builder $q) => $q->where('status', $status))
            ->when($method !== '', fn (Builder $q) => $q->where('method_key', $method))
            ->when($from !== null, fn (Builder $q) => $q->where('created_at', '>=', $from))
            ->when($to !== null, fn (Builder $q) => $q->where('created_at', '<', $to))
            ->when($search !== '', function (Builder $q) use ($search): void {
                $like = '%'.addcslashes($search, '%_\\').'%';
                // «ST-00012» is the store reference the merchant writes on the transfer.
                $storeId = preg_match('/^ST-?0*(\d+)$/i', $search, $m) === 1 ? (int) $m[1] : null;
                $q->where(fn (Builder $w) => $w
                    ->where('sender_ref', 'like', $like)
                    ->orWhereHas('tenant', fn (Builder $t) => $t->where('name', 'like', $like))
                    ->orWhereHas('invoice', fn (Builder $i) => $i->where('number', 'like', $like))
                    ->when($storeId !== null, fn (Builder $x) => $x->orWhere('tenant_id', $storeId)));
            })
            // Oldest first while waiting, newest first otherwise.
            ->orderBy('created_at', $status === 'pending_review' ? 'asc' : 'desc')
            ->orderBy('id')
            ->paginate($this->perPage($request)));

        $repeated = $this->repeatedReferences($page->getCollection()->pluck('sender_ref')->all());
        $counts = Tenancy::withoutTenant(fn () => Payment::query()->selectRaw('status, count(*) as total')->groupBy('status')->pluck('total', 'status'));

        return $this->ok(
            $page->getCollection()->map(fn (Payment $p) => $this->row($p) + ['repeated_ref' => isset($repeated[mb_strtolower(trim($p->sender_ref))])])->values()->all(),
            [
                'current_page' => $page->currentPage(), 'last_page' => $page->lastPage(), 'per_page' => $page->perPage(), 'total' => $page->total(),
                'pending' => (int) ($counts[PaymentStatus::PendingReview->value] ?? 0),
                'counts' => [
                    'pending_review' => (int) ($counts[PaymentStatus::PendingReview->value] ?? 0),
                    'approved' => (int) ($counts[PaymentStatus::Approved->value] ?? 0),
                    'rejected' => (int) ($counts[PaymentStatus::Rejected->value] ?? 0),
                    'all' => (int) $counts->sum(),
                ],
            ],
        );
    }

    /**
     * Transfer numbers on this page that were sent more than once (any store): the same
     * receipt used twice is the first thing to check before approving.
     *
     * @param  list<string>  $refs
     * @return array<string, true>
     */
    private function repeatedReferences(array $refs): array
    {
        $refs = array_values(array_unique(array_filter(array_map(fn ($r) => trim((string) $r), $refs))));
        if ($refs === []) {
            return [];
        }

        return Tenancy::withoutTenant(fn () => Payment::query()
            ->whereIn('sender_ref', $refs)
            ->selectRaw('lower(trim(sender_ref)) as ref, count(*) as total')
            ->groupByRaw('lower(trim(sender_ref))')
            ->havingRaw('count(*) > 1')
            ->pluck('ref')
            ->mapWithKeys(fn ($ref) => [(string) $ref => true])
            ->all());
    }

    public function receipt(int $payment, ReceiptStore $receipts): StreamedResponse
    {
        return $receipts->response($this->find($payment)->receipt_path);
    }

    public function approve(Request $request, int $payment, ManualPayments $payments): JsonResponse
    {
        $done = $payments->approve($this->find($payment), $request->user()?->getAuthIdentifier());

        return $this->ok($this->row($this->find($done->id)));
    }

    public function reject(Request $request, int $payment, ManualPayments $payments): JsonResponse
    {
        $data = $request->validate(['reason' => ['required', 'string', 'min:3', 'max:500']]);
        $done = $payments->reject($this->find($payment), trim(strip_tags($data['reason'])), $request->user()?->getAuthIdentifier());

        return $this->ok($this->row($this->find($done->id)));
    }

    public function refunds(): JsonResponse
    {
        $rows = Tenancy::withoutTenant(fn () => Invoice::query()
            ->with('tenant:id,name')
            ->whereNotNull('refund_requested_at')
            ->whereIn('status', [InvoiceStatus::Paid, InvoiceStatus::Refunded])
            ->orderByRaw('refunded_at is not null')
            ->orderByDesc('refund_requested_at')
            ->limit(100)
            ->get());

        return $this->ok($rows->map(fn (Invoice $i) => [
            'id' => $i->id,
            'number' => $i->number,
            'tenant' => ['id' => $i->tenant_id, 'name' => $i->tenant->name ?? ''],
            'plan_name' => $i->snapshot['plan']['name'] ?? $i->snapshot['theme']['name'] ?? '',
            'total' => Money::toFloat($i->totalCents()),
            'status' => $i->status->value,
            'refund_requested_at' => $i->refund_requested_at?->toIso8601ZuluString(),
            'refund_reason' => $i->refund_reason,
            'refunded_at' => $i->refunded_at?->toIso8601ZuluString(),
            'refund_ref' => $i->refund_ref,
        ])->all());
    }

    public function completeRefund(Request $request, int $invoice, Refunds $refunds): JsonResponse
    {
        $data = $request->validate(['refund_ref' => ['required', 'string', 'min:3', 'max:120']]);
        $model = Tenancy::withoutTenant(fn () => Invoice::query()->findOrFail($invoice));
        $refunds->complete($model, trim(strip_tags($data['refund_ref'])), $request->user()?->getAuthIdentifier());

        return $this->refunds();
    }

    public function methods(): JsonResponse
    {
        return $this->ok(PaymentMethod::query()->orderBy('sort_order')->orderBy('key')->get()->map(fn (PaymentMethod $m) => $this->methodRow($m))->all());
    }

    public function updateMethod(Request $request, string $key, ManageTenant $audit): JsonResponse
    {
        $method = PaymentMethod::query()->findOrFail($key);
        $data = $request->validate([
            'name' => ['required', 'string', 'max:60'],
            'account_label' => ['nullable', 'string', 'max:60'],
            'account_value' => ['nullable', 'string', 'max:120', 'required_if:is_active,true'],
            'instructions' => ['nullable', 'string', 'max:1000'],
            'is_active' => ['required', 'boolean'],
            'sort_order' => ['required', 'integer', 'between:0,1000'],
        ]);
        $before = $this->methodRow($method);
        $clean = fn (?string $v) => $v === null ? null : (trim(strip_tags($v)) ?: null);

        $method->update([
            'name' => $clean($data['name']),
            'account_label' => $clean($data['account_label'] ?? null),
            'account_value' => $clean($data['account_value'] ?? null),
            'instructions' => $clean($data['instructions'] ?? null),
            'is_active' => (bool) $data['is_active'],
            'sort_order' => (int) $data['sort_order'],
        ]);
        $audit->audit('payment_method.update', $method->key, ['before' => $before, 'after' => $this->methodRow($method)], 'payment_method');

        return $this->ok($this->methodRow($method));
    }

    private function find(int $id): Payment
    {
        return Tenancy::withoutTenant(fn () => Payment::query()->with(['invoice', 'tenant:id,name', 'method:key,name'])->findOrFail($id));
    }

    /** @return array<string, mixed> */
    private function row(Payment $p): array
    {
        $invoice = $p->invoice;

        return [
            'id' => $p->id,
            'status' => $p->status->value,
            'tenant' => ['id' => $p->tenant_id, 'name' => $p->tenant->name ?? '', 'reference' => ManualGateway::storeReference($p->tenant_id)],
            'method' => ['key' => $p->method_key, 'name' => $p->method->name ?? $p->method_key],
            'amount' => Money::toFloat($p->amountCents()),
            'sender_ref' => $p->sender_ref,
            'reject_reason' => $p->reject_reason,
            'created_at' => $p->created_at?->toIso8601ZuluString(),
            'reviewed_at' => $p->reviewed_at?->toIso8601ZuluString(),
            'invoice' => $invoice === null ? null : [
                'id' => $invoice->id,
                'number' => $invoice->number,
                'status' => $invoice->status->value,
                'type' => $invoice->type,
                'plan_name' => $invoice->snapshot['plan']['name'] ?? $invoice->snapshot['theme']['name'] ?? '',
                'period' => $invoice->period?->value,
                'total' => Money::toFloat($invoice->totalCents()),
                'starts_now' => $invoice->starts_now,
            ],
        ];
    }

    /** @return array<string, mixed> */
    private function methodRow(PaymentMethod $m): array
    {
        return [
            'key' => $m->key, 'name' => $m->name, 'kind' => $m->kind, 'account_label' => $m->account_label,
            'account_value' => $m->account_value, 'instructions' => $m->instructions, 'is_active' => $m->is_active, 'sort_order' => $m->sort_order,
        ];
    }
}
