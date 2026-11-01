<?php

declare(strict_types=1);

namespace App\Pricing;

use App\Enums\OfferType;
use App\Models\DiscountCode;
use App\Models\DiscountCodeRedemption;
use App\Models\Offer;
use App\Models\Product;
use App\Models\ProductOption;
use App\Models\ProductOptionValue;
use Carbon\CarbonInterface;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * The single source of truth for prices (section 7.1). Runs inside the product's
 * tenant context and never reads the HTTP request.
 */
final class PriceCalculator
{
    public const MIN_QUANTITY = 1;

    public const MAX_QUANTITY = 20;

    public function __construct(private readonly Shipping $shipping = new Shipping) {}

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
    ): Quote {
        if ($quantity < self::MIN_QUANTITY || $quantity > self::MAX_QUANTITY) {
            throw ValidationException::withMessages([
                'quantity' => [__('pricing.quantity_range', ['min' => self::MIN_QUANTITY, 'max' => self::MAX_QUANTITY])],
            ]);
        }

        $productPrice = $product->priceCents();
        [$deltaSum, $selected] = $this->resolveOptions($product, $selectedOptions);

        $unitPrice = $productPrice + $deltaSum;
        $baseSubtotal = $unitPrice * $quantity;

        [$offer, $afterOffer, $gift, $offerError] = $this->applyOffer($product, $now, $baseSubtotal, $quantity, $productPrice, $deltaSum, $offerId);
        $offerDiscount = $baseSubtotal - $afterOffer;

        $discountCode = null;
        $codeDiscount = 0;
        $codeError = null;

        $code = $code === null ? '' : DiscountCode::normalizeCode($code);
        if ($code !== '') {
            [$discountCode, $codeError] = $this->checkCode($code, $product, $now, $phone, $afterOffer, $offer !== null, $lockCode);

            if ($discountCode !== null) {
                $codeDiscount = PriceMath::codeDiscount(
                    $discountCode->type,
                    $discountCode->valueCents(),
                    $discountCode->maxDiscountCents(),
                    $afterOffer,
                );
            }
        }

        $itemsTotal = max(0, $afterOffer - $codeDiscount);
        $shipping = $this->shipping->quote($governorate, $itemsTotal);

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
            total: $itemsTotal + ($shipping['fee'] ?? 0),
            selectedValues: $selected,
            shipping: $shipping['fee'],
            shippingFree: $shipping['free'],
            shippingAvailable: $shipping['available'],
            gift: $gift,
            offerError: $offerError,
        );
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
     * @return array{0: array{id: int, name: string, type: OfferType}|null, 1: int, 2: array{product_id: int, name: string, price: int}|null, 3: string|null}
     */
    private function applyOffer(Product $product, CarbonInterface $now, int $baseSubtotal, int $quantity, int $productPrice, int $deltaSum, ?int $offerId): array
    {
        if ($offerId === 0) {
            return [null, $baseSubtotal, null, null];
        }

        $offers = Offer::query()
            ->activeAt($now)
            ->whereHas('products', fn ($q) => $q->where('products.id', $product->id))
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
        if ($product === null || $product->trashed() || ! $product->is_active || $product->options->contains(fn ($option) => $option->is_required)) {
            return null;
        }

        return ['product_id' => $product->id, 'name' => $product->name, 'price' => $product->priceCents()];
    }

    /**
     * Checks a..g of section 7.1 in order and returns the first failure message.
     *
     * @return array{0: DiscountCode|null, 1: string|null}
     */
    private function checkCode(string $code, Product $product, CarbonInterface $now, ?string $phone, int $afterOffer, bool $offerApplied, bool $lock): array
    {
        $query = DiscountCode::query()->where('code', $code);
        if ($lock) {
            $query->lockForUpdate();
        }
        $discountCode = $query->first();

        // a. exists and active
        if ($discountCode === null || ! $discountCode->is_active) {
            return [null, __('pricing.code_invalid')];
        }

        // b. inside its window (both bounds inclusive)
        if ($discountCode->starts_at !== null && $now->lessThan($discountCode->starts_at)) {
            return [null, __('pricing.code_not_started')];
        }
        if ($discountCode->ends_at !== null && $now->greaterThan($discountCode->ends_at)) {
            return [null, __('pricing.code_expired')];
        }

        // c. applies to the product (no rows = every product)
        $restricted = DB::table('discount_code_products')->where('discount_code_id', $discountCode->id);
        if ($restricted->exists() && ! (clone $restricted)->where('product_id', $product->id)->exists()) {
            return [null, __('pricing.code_wrong_product')];
        }

        // d. total usage limit
        if ($discountCode->usage_limit !== null && $discountCode->used_count >= $discountCode->usage_limit) {
            return [null, __('pricing.code_used_up')];
        }

        // e. per-phone limit (unreleased uses of the same number)
        if ($phone !== null && $phone !== '' && $discountCode->usage_limit_per_phone !== null) {
            $uses = DiscountCodeRedemption::query()
                ->where('discount_code_id', $discountCode->id)
                ->where('phone', $phone)
                ->whereNull('released_at')
                ->count();

            if ($uses >= $discountCode->usage_limit_per_phone) {
                return [null, __('pricing.code_phone_limit')];
            }
        }

        // f. minimum order total (after the offer)
        $minimum = $discountCode->minOrderTotalCents();
        if ($minimum !== null && $afterOffer < $minimum) {
            return [null, __('pricing.code_minimum', ['amount' => number_format($minimum / 100, $minimum % 100 === 0 ? 0 : 2)])];
        }

        // g. stacking with offers
        if ($offerApplied && ! $discountCode->stackable_with_offers) {
            return [null, __('pricing.code_not_stackable')];
        }

        return [$discountCode, null];
    }
}
