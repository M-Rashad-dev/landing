<?php

declare(strict_types=1);

namespace App\Actions\Orders;

use App\Billing\Entitlements;
use App\Enums\OrderStatus;
use App\Enums\PlanFeature;
use App\Enums\WebhookEvent;
use App\Exceptions\ApiException;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Product;
use App\Models\Upsell;
use App\Services\PublicPageData;
use App\Services\Webhooks\WebhookDispatcher;
use App\Support\Money;
use Illuminate\Support\Facades\DB;

/**
 * Picks the post-order offer for a new order and adds it on acceptance.
 * The visitor proves the order is theirs with a signed token returned when it was created;
 * the offer stays open for 30 minutes and only once per order.
 */
final class PostOrderUpsell
{
    public const WINDOW_SECONDS = 1800;

    public function __construct(
        private readonly PublicPageData $data,
        private readonly WebhookDispatcher $webhooks,
    ) {}

    /** The best active offer for this order, as shown on the success screen. @return array<string, mixed>|null */
    public function offerFor(Order $order): ?array
    {
        $upsell = $this->candidate($order);
        if ($upsell === null) {
            return null;
        }

        $product = $upsell->offerProduct;
        $public = $this->data->product($product);

        return [
            'id' => $upsell->id,
            'token' => $this->token($order),
            'headline' => $upsell->headline,
            'description' => $upsell->description,
            'product' => ['name' => $product->name, 'image' => $public['images'][0] ?? null],
            'price' => Money::toFloat($upsell->priceCents()),
            'regular_price' => Money::toFloat($product->priceCents()),
        ];
    }

    /** @return array{order_number: int, total: float} */
    public function accept(Order $order, int $upsellId, string $token): array
    {
        if (! $this->tokenValid($order, $token) || $order->status !== OrderStatus::New || $order->created_at->lt(now()->subSeconds(self::WINDOW_SECONDS))) {
            throw new ApiException(422, 'upsell_closed', __('orders.upsell_closed'));
        }

        $result = DB::transaction(function () use ($order, $upsellId): array {
            /** @var Order $locked */
            $locked = Order::query()->whereKey($order->id)->lockForUpdate()->firstOrFail();
            $upsell = $this->candidate($locked);

            if ($upsell === null || $upsell->id !== $upsellId || $locked->items()->whereNotNull('upsell_id')->exists()) {
                throw new ApiException(422, 'upsell_closed', __('orders.upsell_closed'));
            }

            $price = $upsell->priceCents();
            OrderItem::query()->create([
                'order_id' => $locked->id,
                'product_id' => $upsell->offer_product_id,
                'upsell_id' => $upsell->id,
                'product_name' => $upsell->offerProduct->name,
                'unit_price' => Money::toDecimal($price),
                'quantity' => 1,
                'options' => null,
                'line_total' => Money::toDecimal($price),
            ]);
            $locked->forceFill(['total' => Money::toDecimal(Money::toCents((string) $locked->total) + $price)])->save();

            return ['order_number' => $locked->order_number, 'total' => Money::toFloat(Money::toCents((string) $locked->total))];
        });

        $this->webhooks->order(WebhookEvent::OrderUpdated, $order->refresh());

        return $result;
    }

    /** Active offer for the order's product (or any product), the offered product sellable without choices. */
    private function candidate(Order $order): ?Upsell
    {
        if (! app(Entitlements::class)->allows(PlanFeature::Upsells)) {
            return null;
        }

        return Upsell::query()
            ->with('offerProduct.options')
            ->where('is_active', true)
            ->where(fn ($q) => $q->whereNull('trigger_product_id')->orWhere('trigger_product_id', $order->product_id))
            ->where('offer_product_id', '!=', $order->product_id)
            ->orderByRaw('trigger_product_id is null')
            ->orderByDesc('priority')
            ->orderBy('id')
            ->get()
            ->first(fn (Upsell $upsell) => self::sellable($upsell->offerProduct));
    }

    /** One click means no option to choose: products with required options cannot be offered. */
    public static function sellable(?Product $product): bool
    {
        return $product !== null && ! $product->trashed() && $product->is_active && ! $product->isLockedByPlan() && ! $product->options->contains(fn ($option) => $option->is_required);
    }

    private function token(Order $order): string
    {
        return hash_hmac('sha256', 'upsell|'.$order->tenant_id.'|'.$order->id.'|'.$order->created_at->getTimestamp(), (string) config('app.key'));
    }

    private function tokenValid(Order $order, string $token): bool
    {
        return hash_equals($this->token($order), $token);
    }
}
