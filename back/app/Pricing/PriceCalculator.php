<?php

declare(strict_types=1);

namespace App\Pricing;

use App\Enums\DiscountType;
use App\Enums\OfferType;
use App\Enums\OrderStatus;
use App\Enums\PromotionTarget;
use App\Models\DiscountCode;
use App\Models\DiscountCodeRedemption;
use App\Models\Offer;
use App\Models\Order;
use App\Models\Product;
use App\Models\ProductOption;
use App\Models\ProductOptionValue;
use App\Store\Stock;
use Carbon\CarbonInterface;
use Illuminate\Validation\ValidationException;

/**
 * The single source of truth for prices (section 7.1). Runs inside the product's
 * tenant context and never reads the HTTP request.
 */
final class PriceCalculator
{
    public const MIN_QUANTITY = 1;

    public const MAX_QUANTITY = 20;

    /** Lines in one store order (cart). */
    public const MAX_CART_LINES = 30;

    public function __construct(
        private readonly Shipping $shipping = new Shipping,
        private readonly Stock $stock = new Stock,
        private readonly CategoryAncestry $ancestry = new CategoryAncestry,
    ) {}

    /**
     * @param  array<int|string, int|string|null>  $selectedOptions  option_id => value_id
     *
     * @throws ValidationException on invalid quantity or options (keys: quantity, options.{option_id})
     */
    public function quote(
        Product $product,
        int $quantity,
        array $selectedOptions,
        CarbonInterface $now,
        ?string $code = null,
        ?string $phone = null,
        bool $lockCode = false,
        ?string $governorate = null,
        ?int $offerId = null,
        ?int $shippingCompanyId = null,
    ): Quote {
        if ($quantity < self::MIN_QUANTITY || $quantity > self::MAX_QUANTITY) {
            throw ValidationException::withMessages([
                'quantity' => [__('pricing.quantity_range', ['min' => self::MIN_QUANTITY, 'max' => self::MAX_QUANTITY])],
            ]);
        }

        $productPrice = $product->priceCents();
        [$deltaSum, $selected] = $this->resolveOptions($product, $selectedOptions);

        // A value may lower the price; the unit price never goes below zero.
        $unitPrice = max(0, $productPrice + $deltaSum);
        $this->ensureStock($product, $selected, $quantity, 'quantity');
        $baseSubtotal = $unitPrice * $quantity;

        $categories = $this->ancestry->forProducts([$product])[$product->id] ?? [];
        [$offer, $afterOffer, $gift, $offerError] = $this->applyOffer($product, $categories, $now, $baseSubtotal, $quantity, $productPrice, $deltaSum, $offerId);
        $offerDiscount = $baseSubtotal - $afterOffer;

        $basket = new Basket([['product_id' => $product->id, 'categories' => $categories, 'quantity' => $quantity, 'total' => $afterOffer, 'offer' => $offer !== null]]);
        [$discountCode, $codeDiscount, $codeError] = $this->applyCode($code, $basket, $now, $phone, $lockCode);

        $itemsTotal = max(0, $afterOffer - $codeDiscount);
        $shipping = $this->shipping->quote($governorate, $shippingCompanyId, $itemsTotal, $basket, $discountCode?->type === DiscountType::FreeShipping, $now);

        return new Quote(
            unitPrice: $unitPrice,
            quantity: $quantity,
            baseSubtotal: $baseSubtotal,
            offer: $offer,
            offerDiscount: $offerDiscount,
            subtotalAfterOffer: $afterOffer,
            code: $discountCode,
            codeDiscount: $codeDiscount,
            codeError: $codeError,
            total: $itemsTotal + ($shipping->fee ?? 0),
            selectedValues: $selected,
            delivery: $shipping,
            gift: $gift,
            offerError: $offerError,
        );
    }

    /**
     * A store cart: each line priced like a page order (options, the product's automatic
     * offer, stock), then the code on the lines it applies to, then shipping on the total.
     * Error keys: items.{i}.quantity, items.{i}.options.{option_id}, code.
     *
     * @param  list<array{product: Product, quantity: int, options: array<int|string, int|string|null>}>  $lines
     */
    public function quoteCart(array $lines, CarbonInterface $now, ?string $code = null, ?string $phone = null, bool $lockCode = false, ?string $governorate = null, ?int $shippingCompanyId = null): CartQuote
    {
        if ($lines === [] || count($lines) > self::MAX_CART_LINES) {
            throw ValidationException::withMessages(['items' => [__('store.cart_size', ['max' => self::MAX_CART_LINES])]]);
        }

        $priced = [];
        $errors = [];
        $ancestry = $this->ancestry->forProducts(array_map(fn (array $l) => $l['product'], $lines));
        foreach (array_values($lines) as $i => $line) {
            $product = $line['product'];
            $quantity = $line['quantity'];
            try {
                if ($quantity < self::MIN_QUANTITY || $quantity > self::MAX_QUANTITY) {
                    throw ValidationException::withMessages(['quantity' => [__('pricing.quantity_range', ['min' => self::MIN_QUANTITY, 'max' => self::MAX_QUANTITY])]]);
                }
                [$deltaSum, $selected] = $this->resolveOptions($product, $line['options']);
                $this->ensureStock($product, $selected, $quantity, 'quantity');
            } catch (ValidationException $e) {
                foreach ($e->errors() as $key => $messages) {
                    $errors["items.{$i}.{$key}"] = $messages;
                }

                continue;
            }

            $productPrice = $product->priceCents();
            $unit = max(0, $productPrice + $deltaSum);
            $base = $unit * $quantity;
            [$offer, $afterOffer, $gift] = $this->applyOffer($product, $ancestry[$product->id] ?? [], $now, $base, $quantity, $productPrice, $deltaSum, null);

            $priced[] = new CartLine($product, $quantity, $unit, $base, $offer, $base - $afterOffer, $afterOffer, $selected, $gift);
        }

        if ($errors !== []) {
            throw ValidationException::withMessages($errors);
        }

        $subtotal = array_sum(array_map(fn (CartLine $l) => $l->afterOffer, $priced));
        $basket = new Basket(array_map(fn (CartLine $l) => [
            'product_id' => $l->product->id,
            'categories' => $ancestry[$l->product->id] ?? [],
            'quantity' => $l->quantity,
            'total' => $l->afterOffer,
            'offer' => $l->offer !== null,
        ], $priced));
        [$discountCode, $codeDiscount, $codeError] = $this->applyCode($code, $basket, $now, $phone, $lockCode);

        $itemsTotal = max(0, $subtotal - $codeDiscount);
        $shipping = $this->shipping->quote($governorate, $shippingCompanyId, $itemsTotal, $basket, $discountCode?->type === DiscountType::FreeShipping, $now);

        return new CartQuote(
            lines: $priced,
            subtotal: $subtotal,
            code: $discountCode,
            codeDiscount: $codeDiscount,
            codeError: $codeError,
            delivery: $shipping,
            total: $itemsTotal + ($shipping->fee ?? 0),
        );
    }

    /**
     * The code on the items it covers: [code or null, discount in cents, error or null].
     * A free-shipping code takes nothing off the products (the delivery fee becomes zero).
     *
     * @return array{0: DiscountCode|null, 1: int, 2: string|null}
     */
    private function applyCode(?string $code, Basket $basket, CarbonInterface $now, ?string $phone, bool $lock): array
    {
        $code = $code === null ? '' : DiscountCode::normalizeCode($code);
        if ($code === '') {
            return [null, 0, null];
        }

        [$discountCode, $error, $covered] = $this->checkCode($code, $basket, $now, $phone, $lock);
        if ($discountCode === null || $covered === null) {
            return [null, 0, $error];
        }

        return [$discountCode, PriceMath::codeDiscount($discountCode->type, $discountCode->valueCents(), $discountCode->maxDiscountCents(), $covered->total()), null];
    }

    /** @param list<array{option_id: int, option: string, value_id: int, value: string, price_delta: int}> $selected */
    private function ensureStock(Product $product, array $selected, int $quantity, string $field): void
    {
        $left = $this->stock->available($product, $selected);
        if ($left !== null && $quantity > $left) {
            throw ValidationException::withMessages([$field => [$left <= 0 ? __('store.out_of_stock') : __('store.only_left', ['count' => $left])]]);
        }
    }

    /**
     * Every required option needs a value; each value must belong to its option and be active.
     *
     * @param  array<int|string, int|string|null>  $selectedOptions
     * @return array{0: int, 1: list<array{option_id: int, option: string, value_id: int, value: string, price_delta: int}>}
     */
    private function resolveOptions(Product $product, array $selectedOptions): array
    {
        $product->loadMissing('options.values');
        $errors = [];
        $deltaSum = 0;
        $selected = [];

        $known = $product->options->keyBy('id');
        foreach (array_keys($selectedOptions) as $optionId) {
            if (! $known->has((int) $optionId)) {
                $errors["options.{$optionId}"] = [__('pricing.option_unknown')];
            }
        }

        /** @var ProductOption $option */
        foreach ($product->options as $option) {
            $raw = $selectedOptions[$option->id] ?? $selectedOptions[(string) $option->id] ?? null;

            if ($raw === null || $raw === '') {
                if ($option->is_required) {
                    $errors["options.{$option->id}"] = [__('pricing.option_required', ['option' => $option->name])];
                }

                continue;
            }

            /** @var ProductOptionValue|null $value */
            $value = $option->values->first(fn (ProductOptionValue $v) => $v->id === (int) $raw && $v->is_active);

            if ($value === null) {
                $errors["options.{$option->id}"] = [__('pricing.option_value_invalid', ['option' => $option->name])];

                continue;
            }

            $deltaSum += $value->priceDeltaCents();
            $selected[] = [
                'option_id' => $option->id,
                'option' => $option->name,
                'value_id' => $value->id,
                'value' => $value->label,
                'price_delta' => $value->priceDeltaCents(),
            ];
        }

        if ($errors !== []) {
            throw ValidationException::withMessages($errors);
        }

        return [$deltaSum, $selected];
    }

    /**
     * The offer for this quantity. $offerId null = automatic (merchant priority, then cheapest);
     * 0 = the customer chose no offer; a positive id = the customer's choice, applied only when it
     * is active for this product and the quantity qualifies (otherwise no offer and a reason).
     *
     * @param  list<int>  $categoryIds  the product's categories with their ancestors
     * @return array{0: array{id: int, name: string, type: OfferType}|null, 1: int, 2: array{product_id: int, name: string, price: int}|null, 3: string|null}
     */
    private function applyOffer(Product $product, array $categoryIds, CarbonInterface $now, int $baseSubtotal, int $quantity, int $productPrice, int $deltaSum, ?int $offerId): array
    {
        if ($offerId === 0) {
            return [null, $baseSubtotal, null, null];
        }

        $offers = Offer::query()
            ->activeAt($now)
            ->servable()
            ->forProduct($product->id, $categoryIds)
            ->when($offerId !== null, fn ($q) => $q->whereKey($offerId))
            ->with(['giftProduct' => fn ($q) => $q->with('options')])
            ->get();

        $candidates = [];
        $byId = [];
        foreach ($offers as $offer) {
            $gift = $offer->type === OfferType::Gift ? $this->gift($offer) : null;
            if ($offer->type === OfferType::Gift && $gift === null) {
                continue;
            }
            $total = PriceMath::offerTotal(
                $offer->type,
                $offer->valueCents(),
                $offer->bundle_quantity,
                $offer->bundlePriceCents(),
                $baseSubtotal,
                $quantity,
                $productPrice,
                $deltaSum,
                $offer->min_quantity,
                $offer->free_quantity,
            );

            if ($total !== null) {
                $candidates[] = ['id' => $offer->id, 'priority' => $offer->priority, 'total' => $total, 'rank' => $total - ($gift['price'] ?? 0)];
                $byId[$offer->id] = [$offer, $gift];
            }
        }

        $best = PriceMath::bestOffer($candidates);

        if ($best === null) {
            $chosen = $offerId !== null ? $offers->first() : null;

            return [null, $baseSubtotal, null, $chosen === null ? null : __('pricing.offer_needs_quantity', ['quantity' => $chosen->requiredQuantity()])];
        }

        [$offer, $gift] = $byId[$best['id']];

        return [['id' => $offer->id, 'name' => $offer->name, 'type' => $offer->type], $best['total'], $gift, null];
    }

    /** The free product of a gift offer, when it can still be given (active, nothing to choose). */
    private function gift(Offer $offer): ?array
    {
        $product = $offer->giftProduct;
        if ($product === null || $product->trashed() || ! $product->is_active || $product->isLockedByPlan() || $product->options->contains(fn ($option) => $option->is_required)) {
            return null;
        }
        // A tracked gift needs one unit left.
        if ($this->stock->available($product, []) === 0) {
            return null;
        }

        return ['product_id' => $product->id, 'name' => $product->name, 'price' => $product->priceCents()];
    }

    /**
     * Checks a..g of section 7.1 in order (plus first order and pieces) and returns the first failure.
     *
     * @return array{0: DiscountCode|null, 1: string|null, 2: Basket|null} the code, the error, the items it covers
     */
    private function checkCode(string $code, Basket $basket, CarbonInterface $now, ?string $phone, bool $lock): array
    {
        // A code locked by a downgrade answers like an unknown code.
        $query = DiscountCode::query()->where('code', $code)->servable();
        if ($lock) {
            $query->lockForUpdate();
        }
        $discountCode = $query->first();

        // a. exists and active
        if ($discountCode === null || ! $discountCode->is_active) {
            return [null, __('pricing.code_invalid'), null];
        }

        // b. inside its window (both bounds inclusive)
        if ($discountCode->starts_at !== null && $now->lessThan($discountCode->starts_at)) {
            return [null, __('pricing.code_not_started'), null];
        }
        if ($discountCode->ends_at !== null && $now->greaterThan($discountCode->ends_at)) {
            return [null, __('pricing.code_expired'), null];
        }

        // c. covers at least one of the products (all / products / categories and the ones under them)
        $covered = $basket->covered(
            $discountCode->applies_to,
            $discountCode->applies_to === PromotionTarget::Products ? $discountCode->products()->pluck('products.id')->map(fn ($id) => (int) $id)->all() : [],
            $discountCode->applies_to === PromotionTarget::Categories ? $discountCode->categories()->pluck('categories.id')->map(fn ($id) => (int) $id)->all() : [],
        );
        if ($covered->isEmpty()) {
            return [null, __('pricing.code_wrong_product'), null];
        }

        // d. total usage limit
        if ($discountCode->usage_limit !== null && $discountCode->used_count >= $discountCode->usage_limit) {
            return [null, __('pricing.code_used_up'), null];
        }

        if ($phone !== null && $phone !== '') {
            // e. per-phone limit (unreleased uses of the same number)
            if ($discountCode->usage_limit_per_phone !== null) {
                $uses = DiscountCodeRedemption::query()
                    ->where('discount_code_id', $discountCode->id)
                    ->where('phone', $phone)
                    ->whereNull('released_at')
                    ->count();

                if ($uses >= $discountCode->usage_limit_per_phone) {
                    return [null, __('pricing.code_phone_limit'), null];
                }
            }

            // First order only: the number has no earlier real order.
            if ($discountCode->first_order_only && Order::query()->where('customer_phone', $phone)
                ->whereNotIn('status', [OrderStatus::Fake->value, OrderStatus::Cancelled->value])->exists()) {
                return [null, __('pricing.code_first_order'), null];
            }
        }

        // f. minimum total (after the offers) and pieces of the covered products
        $minimum = $discountCode->minOrderTotalCents();
        if ($minimum !== null && $covered->total() < $minimum) {
            return [null, __('pricing.code_minimum', ['amount' => number_format($minimum / 100, $minimum % 100 === 0 ? 0 : 2)]), null];
        }
        if ($discountCode->min_quantity !== null && $covered->quantity() < $discountCode->min_quantity) {
            return [null, __('pricing.code_min_quantity', ['quantity' => $discountCode->min_quantity]), null];
        }

        // g. stacking with offers
        if ($covered->hasOffer() && ! $discountCode->stackable_with_offers) {
            return [null, __('pricing.code_not_stackable'), null];
        }

        return [$discountCode, null, $covered];
    }
}
