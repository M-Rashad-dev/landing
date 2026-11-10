<?php

declare(strict_types=1);

namespace App\Actions\Orders;

use App\Actions\Analytics\RecordPageEvent;
use App\Enums\OrderStatus;
use App\Enums\WebhookEvent;
use App\Exceptions\ApiException;
use App\Models\BlockedCustomer;
use App\Models\DiscountCode;
use App\Models\DiscountCodeRedemption;
use App\Models\LandingPage;
use App\Models\Order;
use App\Models\Product;
use App\Pricing\PriceCalculator;
use App\Pricing\Quote;
use App\Services\FormToken;
use App\Services\Webhooks\WebhookDispatcher;
use App\Store\Stock;
use App\Support\Money;
use App\Support\OrderForm;
use App\Tenancy\Tenancy;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Validation\ValidationException;

/**
 * Visitor order from a published page (section 7.3). Runs inside the page's tenant context.
 * Prices are always recomputed here; nothing the browser sends is trusted except the choices.
 */
final class CreateOrder
{
    public const IP_LIMIT = 5;

    public const PHONE_LIMIT = 3;

    public const LIMIT_WINDOW_SECONDS = 600;

    private const UTM_KEYS = ['source', 'medium', 'campaign', 'content', 'term', 'referrer'];

    public function __construct(
        private readonly PriceCalculator $calculator,
        private readonly FormToken $tokens,
        private readonly OrderForm $form,
        private readonly PostOrderUpsell $upsells,
        private readonly CaptureLead $leads,
        private readonly RecordPageEvent $events,
        private readonly WebhookDispatcher $webhooks,
        private readonly Stock $stock,
    ) {}

    /**
     * @param  array<string, mixed>  $input  validated PublicOrderRequest data
     * @return array{order_number: int, total: float}
     */
    public function handle(LandingPage $page, array $input): array
    {
        $tenantId = (int) Tenancy::id();

        // 1. Page has a visible order form and an active product.
        $props = OrderForm::section($page->published_content);
        if ($props === null) {
            throw new ApiException(422, 'form_unavailable', __('orders.form_unavailable'));
        }
        $product = $page->product;
        if ($product === null || $product->trashed() || ! $product->is_active || $product->isLockedByPlan()) {
            throw new ApiException(422, 'product_unavailable', __('orders.product_unavailable'));
        }

        // 2. Bot traps: honeypot + signed form token (3 s .. 2 h old).
        if (trim((string) ($input['website'] ?? '')) !== '' || ! $this->tokens->isValid($input['form_token'] ?? null, $page->id)) {
            throw $this->rejected();
        }

        // 3. Rate limit per IP (successful orders).
        $ip = isset($input['ip']) && is_string($input['ip']) && $input['ip'] !== '' ? $input['ip'] : null;
        $ipKey = "orders:ip:{$tenantId}:".($ip ?? 'none');
        if ($ip !== null && RateLimiter::tooManyAttempts($ipKey, self::IP_LIMIT)) {
            throw $this->rejected(429);
        }

        // 5. Dynamic validation from the published settings (+ phone normalization).
        $clean = $this->form->validate($props, (array) ($input['customer'] ?? []), (array) ($input['answers'] ?? []));
        $customer = $clean['customer'];
        $phone = (string) $customer['phone'];

        $phoneKey = "orders:phone:{$tenantId}:{$phone}";
        if (RateLimiter::tooManyAttempts($phoneKey, self::PHONE_LIMIT)) {
            throw $this->rejected(429);
        }

        // 4. Blocked phone or IP → same generic answer.
        if (BlockedCustomer::isBlocked($phone, $ip)) {
            throw $this->rejected();
        }

        $quantity = (int) $input['quantity'];
        $options = (array) ($input['options'] ?? []);
        $code = isset($input['code']) && is_string($input['code']) && trim($input['code']) !== '' ? $input['code'] : null;
        $offerId = OrderForm::chosenOffer($props, $input['offer_id'] ?? null);

        // 6. Quote again (an invalid code fails the order on the "code" field).
        $governorate = $customer['governorate'] ?? null;
        $this->quoteOrFail($product, $quantity, $options, $code, $phone, false, $governorate, $offerId);

        $order = DB::transaction(function () use ($page, $product, $quantity, $options, $code, $phone, $customer, $clean, $ip, $input, $tenantId, $governorate, $offerId) {
            // 7. Lock the code row and re-check its limits.
            $quote = $this->quoteOrFail($product, $quantity, $options, $code, $phone, true, $governorate, $offerId);

            // 8. Sequential number per tenant.
            $number = $this->nextNumber($tenantId);

            // 10. Duplicate suspicion (accepted, flagged).
            $since = now()->subHours((int) config('landing.duplicate_order_window_hours', 24));
            $duplicate = Order::query()
                ->where('customer_phone', $phone)
                ->where('product_id', $product->id)
                ->where('created_at', '>=', $since)
                ->whereNotIn('status', [OrderStatus::Fake->value, OrderStatus::Cancelled->value])
                ->exists();

            // 9. Order + item + first log + redemption.
            $order = Order::query()->create([
                'order_number' => $number,
                'landing_page_id' => $page->id,
                'ab_test_id' => $this->events->testId($page, isset($input['ab']) ? (int) $input['ab'] : null) ?: null,
                'product_id' => $product->id,
                'status' => OrderStatus::New,
                'status_changed_at' => now(),
                'customer_name' => $customer['name'],
                'customer_phone' => $phone,
                'customer_phone2' => $customer['phone2'] ?? null,
                'governorate' => $customer['governorate'] ?? null,
                'city' => $customer['city'] ?? null,
                'address' => $customer['address'] ?? null,
                'notes' => $customer['notes'] ?? null,
                'answers' => $clean['answers'] === [] ? null : $clean['answers'],
                'quantity' => $quote->quantity,
                'unit_price' => Money::toDecimal($quote->unitPrice),
                'subtotal' => Money::toDecimal($quote->baseSubtotal),
                'offer_id' => $quote->offer['id'] ?? null,
                'offer_name' => $quote->offer['name'] ?? null,
                'offer_discount' => Money::toDecimal($quote->offerDiscount),
                'discount_code_id' => $quote->code?->id,
                'discount_code' => $quote->code?->code,
                'code_discount' => Money::toDecimal($quote->codeDiscount),
                'shipping_fee' => Money::toDecimal($quote->shipping ?? 0),
                'total' => Money::toDecimal($quote->total),
                'currency' => 'EGP',
                'is_duplicate_suspect' => $duplicate,
                // 11. Visitor metadata (sent by Next with the internal key).
                'ip_address' => $ip,
                'user_agent' => isset($input['user_agent']) ? mb_substr((string) $input['user_agent'], 0, 500) : null,
                'utm' => $this->utm($input['utm'] ?? null),
            ]);

            $order->items()->create([
                'product_id' => $product->id,
                'product_name' => $product->name,
                'unit_price' => Money::toDecimal($quote->unitPrice),
                'quantity' => $quote->quantity,
                'options' => array_map(fn (array $v) => [
                    'option' => $v['option'],
                    'value' => $v['value'],
                    'price_delta' => Money::toFloat($v['price_delta']),
                ], $quote->selectedValues),
                'line_total' => Money::toDecimal($quote->baseSubtotal),
            ]);
            // Stock (rows locked): a race for the last units fails here with the same message as the quote.
            $lines = [['product' => $product, 'selected' => $quote->selectedValues, 'quantity' => $quote->quantity, 'field' => 'quantity']];
            if ($quote->gift !== null && ($giftProduct = Product::query()->find($quote->gift['product_id'])) !== null) {
                $lines[] = ['product' => $giftProduct, 'selected' => [], 'quantity' => 1, 'field' => 'quantity'];
            }
            $this->stock->take($order, $lines);

            // Gift offer: the free product is its own line at 0.
            if ($quote->gift !== null) {
                $order->items()->create([
                    'product_id' => $quote->gift['product_id'],
                    'product_name' => $quote->gift['name'],
                    'unit_price' => '0.00',
                    'quantity' => 1,
                    'options' => null,
                    'line_total' => '0.00',
                    'is_gift' => true,
                ]);
            }

            $order->logs()->create(['from_status' => null, 'to_status' => OrderStatus::New]);

            if ($quote->code !== null) {
                DiscountCodeRedemption::query()->create([
                    'discount_code_id' => $quote->code->id,
                    'order_id' => $order->id,
                    'phone' => $phone,
                    'amount' => Money::toDecimal($quote->codeDiscount),
                ]);
                DiscountCode::query()->whereKey($quote->code->id)->increment('used_count');
            }

            return $order;
        });

        if ($ip !== null) {
            RateLimiter::hit($ipKey, self::LIMIT_WINDOW_SECONDS);
        }
        RateLimiter::hit($phoneKey, self::LIMIT_WINDOW_SECONDS);
        $this->leads->converted($order);
        $this->webhooks->order(WebhookEvent::OrderCreated, $order);

        // 12. Only what the visitor needs, plus the post-order offer (if any) with its signed token.
        return ['order_number' => $order->order_number, 'total' => (float) $order->total, 'upsell' => $this->upsells->offerFor($order)];
    }

    /**
     * @param  array<int|string, mixed>  $options
     *
     * @throws ValidationException
     */
    private function quoteOrFail(Product $product, int $quantity, array $options, ?string $code, string $phone, bool $lock, ?string $governorate, ?int $offerId = null): Quote
    {
        $quote = $this->calculator->quote($product, $quantity, $options, now(), $code, $phone, $lock, $governorate, $offerId);

        if (! $quote->shippingAvailable) {
            throw ValidationException::withMessages(['customer.governorate' => [__('orders.shipping_unavailable')]]);
        }

        if ($code !== null && $quote->codeError !== null) {
            throw ValidationException::withMessages(['code' => [$quote->codeError]]);
        }

        return $quote;
    }

    private function nextNumber(int $tenantId): int
    {
        DB::table('order_counters')->insertOrIgnore([
            'tenant_id' => $tenantId,
            'last_number' => (int) config('landing.order_number_start', 1001) - 1,
        ]);

        $last = (int) DB::table('order_counters')->where('tenant_id', $tenantId)->lockForUpdate()->value('last_number');
        $next = $last + 1;
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
