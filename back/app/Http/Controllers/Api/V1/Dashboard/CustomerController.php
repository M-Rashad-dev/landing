<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Dashboard;

use App\Enums\BlockType;
use App\Enums\LeadStatus;
use App\Enums\OrderStatus;
use App\Http\Controllers\Concerns\RespondsWithJson;
use App\Http\Controllers\Controller;
use App\Http\Resources\OrderResource;
use App\Models\AbandonedLead;
use App\Models\BlockedCustomer;
use App\Models\Customer;
use App\Services\PhoneNormalizer;
use App\Support\Money;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

/**
 * «العملاء»: every phone that ordered, with what it bought (delivered orders count as spent),
 * returns / fake orders for risk, the merchant's note, and blocking.
 */
final class CustomerController extends Controller
{
    use RespondsWithJson;

    private const SEGMENTS = ['all', 'repeat', 'risky', 'blocked'];

    private const SORTS = ['latest', 'orders', 'spent', 'name'];

    public function index(Request $request): JsonResponse
    {
        $request->validate([
            'segment' => ['nullable', Rule::in(self::SEGMENTS)],
            'sort' => ['nullable', Rule::in(self::SORTS)],
            'q' => ['nullable', 'string', 'max:100'],
        ]);
        $query = $this->withStats(Customer::query());
        $this->search($query, trim((string) $request->query('q', '')));
        $this->segment($query, (string) $request->query('segment', 'all'));

        match ((string) $request->query('sort', 'latest')) {
            'orders' => $query->orderByDesc('orders_count')->orderByDesc('id'),
            'spent' => $query->orderByDesc('spent')->orderByDesc('id'),
            'name' => $query->orderBy('name')->orderBy('id'),
            default => $query->orderByDesc('last_order_at')->orderByDesc('id'),
        };

        $page = $query->paginate($this->perPage($request));
        $blocked = $this->blockedPhones($page->getCollection()->pluck('phone')->all());

        $counts = [];
        foreach (self::SEGMENTS as $segment) {
            $count = $this->withStats(Customer::query());
            $this->segment($count, $segment);
            // The inner query carries the tenant scope; the outer one only counts its rows.
            $counts[$segment] = $segment === 'all' ? Customer::query()->count() : DB::query()->fromSub($count, 'c')->count();
        }

        return $this->ok(
            $page->getCollection()->map(fn (Customer $c) => $this->row($c, in_array($c->phone, $blocked, true)))->values()->all(),
            ['current_page' => $page->currentPage(), 'last_page' => $page->lastPage(), 'per_page' => $page->perPage(), 'total' => $page->total(), 'counts' => $counts],
        );
    }

    public function show(Customer $customer): JsonResponse
    {
        $customer = $this->withStats(Customer::query())->whereKey($customer->id)->firstOrFail();
        $byStatus = $customer->orders()->selectRaw('status, count(*) as aggregate')->groupBy('status')->pluck('aggregate', 'status');

        $block = BlockedCustomer::query()->where('type', BlockType::Phone)->where('value', $customer->phone)->first();

        return $this->ok([
            ...$this->row($customer, $block !== null),
            'block' => $block === null ? null : ['reason' => $block->reason, 'rule' => $block->rule, 'created_at' => $block->created_at?->toIso8601ZuluString()],
            'block_exempt' => $customer->block_exempt,
            'note' => $customer->note,
            'city' => $customer->city,
            'address' => $customer->address,
            'first_order_at' => $customer->first_order_at?->toIso8601ZuluString(),
            'counts' => collect(OrderStatus::cases())->mapWithKeys(fn (OrderStatus $s) => [$s->value => (int) ($byStatus[$s->value] ?? 0)])->all(),
            'average_order' => (int) $customer->delivered_count === 0 ? 0.0 : round((float) $customer->spent / (int) $customer->delivered_count, 2),
            'orders' => OrderResource::collection($customer->orders()->with('items:id,order_id,product_name,quantity,is_gift')->orderByDesc('order_number')->limit(50)->get())->resolve(request()),
            'open_leads' => AbandonedLead::query()->where('customer_phone', $customer->phone)->whereIn('status', [LeadStatus::Open, LeadStatus::Contacted])->latest('id')->limit(10)->get()
                ->map(fn (AbandonedLead $l) => ['id' => $l->id, 'source' => $l->source, 'cart' => $l->cart, 'quantity' => $l->quantity, 'status' => $l->status->value, 'created_at' => $l->created_at->toIso8601ZuluString()])->values()->all(),
        ]);
    }

    /** The merchant's own note about the customer. */
    public function update(Request $request, Customer $customer): JsonResponse
    {
        $data = $request->validate(['note' => ['present', 'nullable', 'string', 'max:2000']]);
        $note = $data['note'] === null ? null : trim(strip_tags($data['note']));
        $customer->update(['note' => $note === '' ? null : $note]);

        return $this->show($customer);
    }

    /** Block or unblock the customer's phone (blocked phones cannot order). */
    public function block(Request $request, Customer $customer): JsonResponse
    {
        $data = $request->validate(['blocked' => ['required', 'boolean'], 'reason' => ['nullable', 'string', 'max:200']]);

        if ($data['blocked']) {
            BlockedCustomer::query()->firstOrCreate(
                ['type' => BlockType::Phone, 'value' => $customer->phone],
                ['reason' => isset($data['reason']) ? trim(strip_tags($data['reason'])) : null],
            );
            $customer->update(['block_exempt' => false]);
        } else {
            $block = BlockedCustomer::query()->where('type', BlockType::Phone)->where('value', $customer->phone)->first();
            // Lifting an automatic block is the merchant's call: the rules leave this customer alone from now on.
            if ($block !== null && $block->rule !== null) {
                $customer->update(['block_exempt' => true]);
            }
            $block?->delete();
        }

        return $this->show($customer);
    }

    /**
     * @param  Builder<Customer>  $query
     * @return Builder<Customer>
     */
    private function withStats(Builder $query): Builder
    {
        return $query
            ->withCount([
                'orders',
                'orders as delivered_count' => fn ($q) => $q->where('status', OrderStatus::Delivered),
                'orders as open_count' => fn ($q) => $q->whereIn('status', [OrderStatus::New, OrderStatus::Confirmed, OrderStatus::Shipped]),
                'orders as bad_count' => fn ($q) => $q->whereIn('status', [OrderStatus::Returned, OrderStatus::Damaged, OrderStatus::Fake]),
            ])
            ->withSum(['orders as spent' => fn ($q) => $q->where('status', OrderStatus::Delivered)], 'total');
    }

    /** @param Builder<Customer> $query */
    private function search(Builder $query, string $q): void
    {
        if ($q === '') {
            return;
        }
        $digits = (string) preg_replace('/\D+/', '', strtr($q, ['٠' => '0', '١' => '1', '٢' => '2', '٣' => '3', '٤' => '4', '٥' => '5', '٦' => '6', '٧' => '7', '٨' => '8', '٩' => '9']));
        $query->where(function (Builder $w) use ($q, $digits): void {
            $w->where('name', 'like', '%'.addcslashes($q, '%_\\').'%');
            if ($digits !== '') {
                $phone = app(PhoneNormalizer::class)->normalize($digits);
                $w->orWhere('phone', 'like', '%'.($phone !== null ? substr($phone, 3) : ltrim($digits, '0')).'%');
            }
        });
    }

    /** @param Builder<Customer> $query */
    private function segment(Builder $query, string $segment): void
    {
        match ($segment) {
            'repeat' => $query->having('orders_count', '>=', 2),
            'risky' => $query->having('bad_count', '>', 0),
            'blocked' => $query->whereIn('phone', BlockedCustomer::query()->where('type', BlockType::Phone)->select('value')),
            default => null,
        };
    }

    /**
     * @param  list<string>  $phones
     * @return list<string>
     */
    private function blockedPhones(array $phones): array
    {
        return $phones === [] ? [] : BlockedCustomer::query()->where('type', BlockType::Phone)->whereIn('value', $phones)->pluck('value')->all();
    }

    /** @return array<string, mixed> */
    private function row(Customer $c, bool $blocked): array
    {
        return [
            'id' => $c->id,
            'name' => $c->name,
            'phone' => $c->phone,
            'governorate' => $c->governorate,
            'orders_count' => (int) $c->orders_count,
            'delivered_count' => (int) $c->delivered_count,
            'open_count' => (int) $c->open_count,
            'bad_count' => (int) $c->bad_count,
            'spent' => Money::toFloat(Money::toCents((string) ($c->spent ?? '0'))),
            'last_order_at' => $c->last_order_at?->toIso8601ZuluString(),
            'blocked' => $blocked,
        ];
    }
}
