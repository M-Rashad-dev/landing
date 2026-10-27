<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Dashboard;

use App\Actions\Orders\ChangeOrderStatus;
use App\Actions\Orders\RecordOrderContact;
use App\Enums\BlockType;
use App\Enums\ContactResult;
use App\Enums\OrderStatus;
use App\Exceptions\ApiException;
use App\Http\Controllers\Concerns\RespondsWithJson;
use App\Http\Controllers\Controller;
use App\Http\Requests\Dashboard\UpdateOrderRequest;
use App\Http\Resources\OrderDetailResource;
use App\Http\Resources\OrderResource;
use App\Models\BlockedCustomer;
use App\Models\Identity;
use App\Models\Order;
use App\Models\Tenant;
use App\Support\Money;
use App\Support\OrderFilters;
use App\Tenancy\Tenancy;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\StreamedResponse;
use Throwable;

final class OrderController extends Controller
{
    use RespondsWithJson;

    private const LIST_RELATIONS = ['product:id,name,deleted_at', 'page:id,title,slug,deleted_at'];

    public function index(Request $request): JsonResponse
    {
        $orders = OrderFilters::apply($request)->with(self::LIST_RELATIONS)->paginate($this->perPage($request));

        return $this->paginated($orders, OrderResource::class);
    }

    /** Counter per status (with the current filters except status) + orders created after ?since= (notifications). */
    public function stats(Request $request): JsonResponse
    {
        $counts = OrderFilters::apply($request, withStatus: false)
            ->reorder()
            ->selectRaw('status, count(*) as aggregate')
            ->groupBy('status')
            ->pluck('aggregate', 'status');

        $byStatus = [];
        foreach (OrderStatus::cases() as $status) {
            $byStatus[$status->value] = (int) ($counts[$status->value] ?? 0);
        }

        $since = null;
        try {
            $since = $request->filled('since') ? CarbonImmutable::parse((string) $request->query('since')) : null;
        } catch (Throwable) {
            $since = null;
        }

        return $this->ok([
            'counts' => $byStatus,
            'all' => array_sum($byStatus),
            'new_since' => $since === null ? null : Order::query()->where('created_at', '>', $since->utc())->count(),
            'latest_id' => Order::query()->max('id'),
            'server_time' => now()->toIso8601ZuluString(),
        ]);
    }

    public function show(Order $order): JsonResponse
    {
        // The page with its identity (the list loads only a few page columns).
        $order->load(['product:id,name,deleted_at', 'page:id,title,slug,identity_id,deleted_at', 'page.identity.logo', 'items', 'logs.user:id,name', 'events.user:id,name']);

        return $this->ok(array_merge(
            OrderDetailResource::make($order)->resolve(request()),
            ['customer_history' => $this->history($order), 'brand' => $this->brand($order)],
        ));
    }

    /** Log a contact attempt on a new order (no answer / postponed / WhatsApp sent). */
    public function contact(Request $request, Order $order, RecordOrderContact $action): JsonResponse
    {
        $data = $request->validate([
            'result' => ['required', Rule::enum(ContactResult::class)],
            'note' => ['nullable', 'string', 'max:500'],
            // Cairo wall time from the dashboard, like the other dates.
            'follow_up_at' => ['required_if:result,postponed', 'nullable', 'date_format:Y-m-d\TH:i'],
        ]);

        $followUp = null;
        if (($data['follow_up_at'] ?? null) !== null) {
            $followUp = CarbonImmutable::createFromFormat('Y-m-d\TH:i', $data['follow_up_at'], (string) config('landing.display_timezone'))->utc();
            if ($followUp->isPast() || $followUp->gt(now()->addDays(30))) {
                throw ValidationException::withMessages(['follow_up_at' => [__('orders.follow_up_range')]]);
            }
        }

        $note = isset($data['note']) ? trim(strip_tags($data['note'])) : '';
        $action->handle($order, ContactResult::from($data['result']), $note === '' ? null : $note, $followUp === null ? null : Carbon::instance($followUp), $request->user()?->getAuthIdentifier());

        return $this->show($order->fresh());
    }

    /**
     * New orders to confirm, in calling order: due callbacks and never-called orders first
     * (oldest first), then the ones scheduled later.
     */
    public function confirmationQueue(): JsonResponse
    {
        $now = now();
        $base = fn () => Order::query()->where('status', OrderStatus::New);
        $due = fn () => $base()->where(fn ($q) => $q->whereNull('follow_up_at')->orWhere('follow_up_at', '<=', $now));

        $orders = $base()
            ->with(self::LIST_RELATIONS)
            ->orderByRaw('(follow_up_at is null or follow_up_at <= ?) desc', [$now])
            ->orderByRaw('follow_up_at is not null')
            ->orderBy('follow_up_at')
            ->orderBy('contact_attempts')
            ->orderBy('order_number')
            ->limit(100)
            ->get();

        return $this->ok(OrderResource::collection($orders), [
            'due' => $due()->count(),
            'later' => $base()->where('follow_up_at', '>', $now)->count(),
        ]);
    }

    public function update(UpdateOrderRequest $request, Order $order): JsonResponse
    {
        $values = $request->values();
        $customerKeys = array_diff(array_keys($values), ['internal_note']);

        if ($customerKeys !== [] && ! $order->status->allowsCustomerEdits()) {
            throw new ApiException(422, 'edit_not_allowed', __('orders.edit_not_allowed', ['status' => $order->status->label()]));
        }

        $order->fill($values)->save();

        return $this->show($order);
    }

    public function changeStatus(Request $request, Order $order, ChangeOrderStatus $action): JsonResponse
    {
        $data = $request->validate([
            'status' => ['required', 'string', Rule::in(OrderStatus::values())],
            'note' => ['nullable', 'string', 'max:500'],
            'block_phone' => ['sometimes', 'boolean'],
            'block_ip' => ['sometimes', 'boolean'],
        ]);

        $action->handle($order, OrderStatus::from($data['status']), $data['note'] ?? null, $request->user()?->getAuthIdentifier(), [
            'block_phone' => (bool) ($data['block_phone'] ?? false),
            'block_ip' => (bool) ($data['block_ip'] ?? false),
        ]);

        return $this->show($order->refresh());
    }

    /** Same rules as a single change, applied per order; one failure never blocks the others. */
    public function bulkStatus(Request $request, ChangeOrderStatus $action): JsonResponse
    {
        $data = $request->validate([
            'ids' => ['required', 'array', 'min:1', 'max:100'],
            'ids.*' => ['integer', 'distinct'],
            'status' => ['required', 'string', Rule::in(OrderStatus::values())],
            'note' => ['nullable', 'string', 'max:500'],
        ]);

        $to = OrderStatus::from($data['status']);
        $orders = Order::query()->whereIn('id', $data['ids'])->get()->keyBy('id');
        $results = [];

        foreach ($data['ids'] as $id) {
            $order = $orders->get($id);
            if ($order === null) {
                $results[] = ['id' => $id, 'ok' => false, 'error' => __('orders.not_found')];

                continue;
            }
            try {
                $action->handle($order, $to, $data['note'] ?? null, $request->user()?->getAuthIdentifier());
                $results[] = ['id' => $id, 'order_number' => $order->order_number, 'ok' => true, 'error' => null];
            } catch (ApiException $e) {
                $results[] = ['id' => $id, 'order_number' => $order->order_number, 'ok' => false, 'error' => $e->getMessage()];
            }
        }

        return $this->ok([
            'results' => $results,
            'succeeded' => count(array_filter($results, fn ($r) => $r['ok'])),
            'failed' => count(array_filter($results, fn ($r) => ! $r['ok'])),
        ]);
    }

    /** CSV (UTF-8 with BOM, opens correctly in Excel) with the list filters; max 10,000 rows. */
    public function export(Request $request): StreamedResponse
    {
        $max = (int) config('landing.limits.export_max_rows', 10000);
        $query = OrderFilters::apply($request)->with(['items', 'page:id,title,slug,deleted_at']);

        if ((clone $query)->count() > $max) {
            throw new ApiException(422, 'export_too_large', __('orders.export_too_large', ['max' => number_format($max)]));
        }

        $filename = 'orders-'.now((string) config('landing.display_timezone'))->format('Y-m-d-His').'.csv';

        // The body is streamed after the tenant middleware has cleared its context.
        $tenantId = (int) Tenancy::id();

        return response()->streamDownload(fn () => Tenancy::runAs($tenantId, function () use ($query): void {
            $out = fopen('php://output', 'wb');
            fwrite($out, "\xEF\xBB\xBF");
            fputcsv($out, ['رقم الطلب', 'التاريخ', 'الحالة', 'الاسم', 'الموبايل', 'المحافظة', 'المدينة', 'العنوان', 'المنتج', 'الخيارات', 'الكمية', 'الإجمالي قبل الخصم', 'خصم العرض', 'خصم الكود', 'الإجمالي', 'الكود', 'الملاحظات', 'الصفحة'], escape: '');

            $tz = (string) config('landing.display_timezone');
            $query->chunk(500, function ($orders) use ($out, $tz): void {
                foreach ($orders as $order) {
                    /** @var Order $order */
                    $item = $order->items->first();
                    $options = collect($item?->options ?? [])->map(fn ($o) => $o['option'].': '.$o['value'])->implode('، ');
                    fputcsv($out, array_map([self::class, 'csvSafe'], [
                        (string) $order->order_number,
                        $order->created_at->setTimezone($tz)->format('Y-m-d H:i'),
                        $order->status->label(),
                        $order->customer_name,
                        $order->customer_phone,
                        (string) $order->governorate,
                        (string) $order->city,
                        (string) $order->address,
                        (string) ($item?->product_name ?? ''),
                        $options,
                        (string) $order->quantity,
                        Money::toDecimal(Money::toCents($order->subtotal)),
                        Money::toDecimal(Money::toCents($order->offer_discount)),
                        Money::toDecimal(Money::toCents($order->code_discount)),
                        Money::toDecimal(Money::toCents($order->total)),
                        (string) $order->discount_code,
                        (string) $order->notes,
                        (string) ($order->page?->title ?? ''),
                    ]), escape: '');
                }
            });

            fclose($out);
        }), $filename, ['Content-Type' => 'text/csv; charset=UTF-8', 'Cache-Control' => 'no-store']);
    }

    /** Neutralise spreadsheet formulas in user-provided cells (CSV injection). */
    public static function csvSafe(string $value): string
    {
        return $value !== '' && in_array($value[0], ['=', '+', '-', '@', "\t", "\r"], true) && ! is_numeric($value) ? "'".$value : $value;
    }

    /**
     * Seller details printed on the invoice: the identity of the page the order came from,
     * else the store's default identity.
     *
     * @return array{name: string, logo: string|null, phone: string|null, whatsapp: string|null, email: string|null, address: string|null}
     */
    private function brand(Order $order): array
    {
        $identity = $order->page?->identity ?? Identity::query()->with('logo')->where('is_default', true)->first();
        $contact = $identity?->resolvedContact() ?? [];

        return [
            'name' => (string) ($identity?->brand_name ?: Tenant::query()->whereKey(Tenancy::id())->value('name') ?: ''),
            'logo' => $identity?->logo?->urls()['medium'] ?? null,
            'phone' => $contact['phone'] ?? null,
            'whatsapp' => $contact['whatsapp'] ?? null,
            'email' => $contact['email'] ?? null,
            'address' => $contact['address'] ?? null,
        ];
    }

    /** @return array<string, mixed> */
    private function history(Order $order): array
    {
        $others = Order::query()->where('customer_phone', $order->customer_phone)->whereKeyNot($order->id);
        $counts = (clone $others)->selectRaw('status, count(*) as aggregate')->groupBy('status')->pluck('aggregate', 'status');
        $total = (int) $counts->sum();
        $bad = (int) (($counts[OrderStatus::Fake->value] ?? 0) + ($counts[OrderStatus::Returned->value] ?? 0));

        return [
            'total' => $total,
            'counts' => collect(OrderStatus::cases())->mapWithKeys(fn (OrderStatus $s) => [$s->value => (int) ($counts[$s->value] ?? 0)])->all(),
            'bad_ratio' => $total === 0 ? 0 : (int) round($bad * 100 / $total),
            'phone_blocked' => BlockedCustomer::query()->where('type', BlockType::Phone)->where('value', $order->customer_phone)->exists(),
            'ip_blocked' => $order->ip_address !== null && BlockedCustomer::query()->where('type', BlockType::Ip)->where('value', $order->ip_address)->exists(),
            'orders' => $others->orderByDesc('order_number')->limit(10)->get(['id', 'order_number', 'status', 'total', 'created_at'])->map(fn (Order $o) => [
                'id' => $o->id,
                'order_number' => $o->order_number,
                'status' => $o->status->value,
                'status_label' => $o->status->label(),
                'total' => Money::toFloat(Money::toCents($o->total)),
                'created_at' => $o->created_at->toIso8601ZuluString(),
            ])->values()->all(),
        ];
    }
}
