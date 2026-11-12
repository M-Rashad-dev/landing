<?php

declare(strict_types=1);

namespace App\Store;

use App\Actions\Orders\AutoBlock;
use App\Actions\Orders\CaptureLead;
use App\Actions\Orders\CreateOrder;
use App\Actions\Orders\LinkCustomer;
use App\Enums\OrderStatus;
use App\Enums\WebhookEvent;
use App\Exceptions\ApiException;
use App\Http\Controllers\Api\V1\Public\StoreAccountController;
use App\Http\Controllers\Api\V1\Public\StoreController as PublicStoreController;
use App\Models\BlockedCustomer;
use App\Models\Customer;
use App\Models\DiscountCode;
use App\Models\DiscountCodeRedemption;
use App\Models\Order;
use App\Models\Product;
use App\Models\Store;
use App\Pricing\CartQuote;
use App\Pricing\PriceCalculator;
use App\Services\FormToken;
use App\Services\Webhooks\WebhookDispatcher;
use App\Support\Money;
use App\Support\OrderForm;
use App\Tenancy\Tenancy;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Validation\ValidationException;

/**
 * A store checkout: one order with a line per cart item (source = store), cash on delivery.
 * Same protections as page orders: honeypot, signed form token, rate limits, blocked
 * customers, prices recomputed here, code locked and re-checked, stock taken in the
 * transaction. Runs inside the store's tenant context.
 */
final class CreateStoreOrder
{
    private const UTM_KEYS = ['source', 'medium', 'campaign', 'content', 'term', 'referrer'];

    public function __construct(
        private readonly PriceCalculator $calculator,
        private readonly FormToken $tokens,
        private readonly OrderForm $form,
        private readonly Stock $stock,
        private readonly CaptureLead $leads,
        private readonly WebhookDispatcher $webhooks,
        private readonly LinkCustomer $customers,
        private readonly AutoBlock $autoBlock,
    ) {}

    /**
     * @param  array<string, mixed>  $input  validated StoreOrderRequest data
     * @param  Customer|null  $account  the signed-in customer: the order goes on their phone
     * @return array{order_number: int, total: float}
     */
    public function handle(Store $store, array $input, ?Customer $account = null): array
    {
        $tenantId = (int) Tenancy::id();

        if (trim((string) ($input['website'] ?? '')) !== '' || ! $this->tokens->isValid($input['form_token'] ?? null, PublicStoreController::formSubject($store))) {
            throw $this->rejected();
        }

        $ip = isset($input['ip']) && is_string($input['ip']) && $input['ip'] !== '' ? $input['ip'] : null;
        $ipKey = "orders:ip:{$tenantId}:".($ip ?? 'none');
        if ($ip !== null && RateLimiter::tooManyAttempts($ipKey, CreateOrder::IP_LIMIT)) {
            throw $this->rejected(429);
        }

        // Standard checkout fields (name, phone, governorate, city, address, notes).
        $fields = (array) ($input['customer'] ?? []);
        if ($account !== null) {
            $fields['phone'] = $account->phone;
        }
        $clean = $this->form->validate([], $fields, []);
        $customer = $clean['customer'];
        $phone = (string) $customer['phone'];
        $phoneKey = "orders:phone:{$tenantId}:{$phone}";
        if (RateLimiter::tooManyAttempts($phoneKey, CreateOrder::PHONE_LIMIT)) {
            throw $this->rejected(429);
        }
        if (BlockedCustomer::isBlocked($phone, $ip)) {
            throw $this->rejected();
        }

        $lines = $this->lines((array) $input['items']);
        $code = isset($input['code']) && is_string($input['code']) && trim($input['code']) !== '' ? $input['code'] : null;
        $governorate = $customer['governorate'] ?? null;
        $companyId = isset($input['shipping_company_id']) ? (int) $input['shipping_company_id'] : null;
        $this->quoteOrFail($lines, $code, $phone, false, $governorate, $companyId);

        $order = DB::transaction(function () use ($lines, $code, $phone, $governorate, $companyId, $customer, $ip, $input, $tenantId): Order {
            $quote = $this->quoteOrFail($lines, $code, $phone, true, $governorate, $companyId);

            $order = Order::query()->create([
                'order_number' => $this->nextNumber($tenantId),
                'source' => 'store',
                'status' => OrderStatus::New,
                'status_changed_at' => now(),
                'customer_name' => $customer['name'],
                'customer_phone' => $phone,
                'customer_phone2' => $customer['phone2'] ?? null,
                'governorate' => $governorate,
                'city' => $customer['city'] ?? null,
                'address' => $customer['address'] ?? null,
                'notes' => $customer['notes'] ?? null,
                'quantity' => $quote->itemsCount(),
                'subtotal' => Money::toDecimal($quote->base()),
                'offer_discount' => Money::toDecimal($quote->offerDiscount()),
                'discount_code_id' => $quote->code?->id,
                'discount_code' => $quote->code?->code,
                'code_discount' => Money::toDecimal($quote->codeDiscount),
                'shipping_fee' => Money::toDecimal($quote->delivery->fee ?? 0),
                'shipping_company_id' => $quote->delivery->company['id'] ?? null,
                'shipping_company_name' => $quote->delivery->company['name'] ?? null,
                'shipping_offer_name' => $quote->delivery->offer['name'] ?? ($quote->delivery->byCode ? $quote->code?->code : null),
                'shipping_discount' => Money::toDecimal($quote->delivery->discount()),
                'total' => Money::toDecimal($quote->total),
                'currency' => 'EGP',
                'is_duplicate_suspect' => Order::query()->where('customer_phone', $phone)->where('created_at', '>=', now()->subHours((int) config('landing.duplicate_order_window_hours', 24)))
                    ->whereNotIn('status', [OrderStatus::Fake->value, OrderStatus::Cancelled->value])->exists(),
                'ip_address' => $ip,
                'user_agent' => isset($input['user_agent']) ? mb_substr((string) $input['user_agent'], 0, 500) : null,
                'utm' => $this->utm($input['utm'] ?? null),
            ]);

            $take = [];
            foreach ($quote->lines as $i => $line) {
                $order->items()->create([
                    'product_id' => $line->product->id,
                    'variant_id' => null,
                    'product_name' => $line->product->name,
                    'unit_price' => Money::toDecimal($line->unitPrice),
                    'quantity' => $line->quantity,
                    'options' => array_map(fn (array $v) => ['option' => $v['option'], 'value' => $v['value'], 'price_delta' => Money::toFloat($v['price_delta'])], $line->selected),
                    'offer_name' => $line->offer['name'] ?? null,
                    'offer_discount' => Money::toDecimal($line->offerDiscount),
                    'line_total' => Money::toDecimal($line->afterOffer),
                ]);
                $take[] = ['product' => $line->product, 'selected' => $line->selected, 'quantity' => $line->quantity, 'field' => "items.{$i}.quantity"];

                if ($line->gift !== null && ($gift = Product::query()->find($line->gift['product_id'])) !== null) {
                    $order->items()->create(['product_id' => $gift->id, 'product_name' => $gift->name, 'unit_price' => '0.00', 'quantity' => 1, 'options' => null, 'line_total' => '0.00', 'is_gift' => true]);
                    $take[] = ['product' => $gift, 'selected' => [], 'quantity' => 1, 'field' => "items.{$i}.quantity"];
                }
            }
            $this->stock->take($order, $take);

            $order->logs()->create(['from_status' => null, 'to_status' => OrderStatus::New]);
            $this->customers->handle($order);

            if ($quote->code !== null) {
                DiscountCodeRedemption::query()->create(['discount_code_id' => $quote->code->id, 'order_id' => $order->id, 'phone' => $phone, 'amount' => Money::toDecimal($quote->codeDiscount + ($quote->delivery->byCode ? $quote->delivery->discount() : 0))]);
                DiscountCode::query()->whereKey($quote->code->id)->increment('used_count');
            }

            return $order;
        });

        if ($ip !== null) {
            RateLimiter::hit($ipKey, CreateOrder::LIMIT_WINDOW_SECONDS);
        }
        RateLimiter::hit($phoneKey, CreateOrder::LIMIT_WINDOW_SECONDS);
        $this->leads->converted($order, isset($input['cart_token']) && is_string($input['cart_token']) ? $input['cart_token'] : null);
        $this->autoBlock->afterOrder($order);
        $this->webhooks->order(WebhookEvent::OrderCreated, $order);
        if ($account !== null && ($input['save_address'] ?? false) === true) {
            $this->saveAddress($account, $order);
        }

        return ['order_number' => $order->order_number, 'total' => (float) $order->total];
    }

    /**
     * Cart items → sellable products (an item for a product that left the store fails on it).
     *
     * @param  list<array<string, mixed>>  $items
     * @return list<array{product: Product, quantity: int, options: array<int|string, int|string|null>}>
     */
    public function lines(array $items): array
    {
        $ids = array_map(fn ($i) => (int) ($i['product_id'] ?? 0), $items);
        $products = Product::query()->where('in_store', true)->where('is_active', true)->servable()
            ->with(['options.values', 'variants'])->whereIn('id', $ids)->get()->keyBy('id');

        $lines = [];
        $errors = [];
        foreach (array_values($items) as $i => $item) {
            $product = $products->get((int) ($item['product_id'] ?? 0));
            if ($product === null) {
                $errors["items.{$i}.product_id"] = [__('store.product_unavailable')];

                continue;
            }
            $lines[] = ['product' => $product, 'quantity' => (int) ($item['quantity'] ?? 1), 'options' => (array) ($item['options'] ?? [])];
        }
        if ($errors !== []) {
            throw ValidationException::withMessages($errors);
        }

        return $lines;
    }

    /** @param list<array{product: Product, quantity: int, options: array<int|string, int|string|null>}> $lines */
    private function quoteOrFail(array $lines, ?string $code, string $phone, bool $lock, ?string $governorate, ?int $companyId = null): CartQuote
    {
        $quote = $this->calculator->quoteCart($lines, now(), $code, $phone, $lock, $governorate, $companyId);
        if (! $quote->delivery->available) {
            throw ValidationException::withMessages(['customer.governorate' => [__('orders.shipping_unavailable')]]);
        }
        if ($quote->delivery->companyMismatch) {
            throw ValidationException::withMessages(['shipping_company_id' => [__('orders.shipping_company_unavailable')]]);
        }
        if ($code !== null && $quote->codeError !== null) {
            throw ValidationException::withMessages(['code' => [$quote->codeError]]);
        }

        return $quote;
    }

    /** «احفظ العنوان ده»: kept for the next checkout, unless it is already saved or the list is full. */
    private function saveAddress(Customer $account, Order $order): void
    {
        $count = $account->addresses()->count();
        if ($order->governorate === null || $order->address === null || $count >= StoreAccountController::MAX_ADDRESSES
            || $account->addresses()->where('governorate', $order->governorate)->where('address', $order->address)->exists()) {
            return;
        }
        $account->addresses()->create([
            'name' => $order->customer_name,
            'governorate' => $order->governorate,
            'city' => $order->city,
            'address' => $order->address,
            'is_default' => $count === 0,
        ]);
    }

    private function nextNumber(int $tenantId): int
    {
        DB::table('order_counters')->insertOrIgnore(['tenant_id' => $tenantId, 'last_number' => (int) config('landing.order_number_start', 1001) - 1]);
        $next = (int) DB::table('order_counters')->where('tenant_id', $tenantId)->lockForUpdate()->value('last_number') + 1;
        DB::table('order_counters')->where('tenant_id', $tenantId)->update(['last_number' => $next]);

        return $next;
    }

    /** @return array<string, string>|null */
    private function utm(mixed $utm): ?array
    {
        if (! is_array($utm)) {
            return null;
        }
        $clean = [];
        foreach (self::UTM_KEYS as $key) {
            $value = $utm[$key] ?? null;
            if (is_string($value) && trim($value) !== '') {
                $clean[$key] = mb_substr(trim(strip_tags($value)), 0, $key === 'referrer' ? 500 : 200);
            }
        }

        return $clean === [] ? null : $clean;
    }

    private function rejected(int $status = 422): ApiException
    {
        return new ApiException($status, 'rejected', __('orders.rejected'));
    }
}
