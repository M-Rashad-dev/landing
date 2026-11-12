<?php

declare(strict_types=1);

namespace App\Pricing;

use App\Enums\PromotionTarget;
use App\Enums\ShippingBenefit;
use App\Models\Media;
use App\Models\ShippingCompany;
use App\Models\ShippingOffer;
use App\Models\ShippingSetting;
use App\Support\Money;
use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Collection;

/**
 * Delivery fee for the current tenant (used by PriceCalculator, the only price authority).
 * Off, or on with no active company → no fee. On → each active company that serves the
 * governorate gives its fee, the best shipping offer (or a free-shipping code) lowers it,
 * and the customer's company is used (else the cheapest).
 */
final class Shipping
{
    public function enabled(): bool
    {
        return (bool) ShippingSetting::query()->value('enabled');
    }

    /** @return Collection<int, ShippingCompany> */
    public function companies(): Collection
    {
        return ShippingCompany::query()->where('is_active', true)->with(['rates', 'logo'])->orderBy('position')->orderBy('id')->get();
    }

    /**
     * @param  int  $itemsTotal  products after offers and code, in cents
     */
    public function quote(?string $governorate, ?int $companyId, int $itemsTotal, Basket $basket, bool $freeByCode, CarbonInterface $now): ShippingQuote
    {
        if (! $this->enabled()) {
            return new ShippingQuote;
        }
        $companies = $this->companies();
        if ($companies->isEmpty()) {
            return new ShippingQuote;
        }
        if ($governorate === null || trim($governorate) === '') {
            return new ShippingQuote;
        }

        $offers = $freeByCode ? new Collection : ShippingOffer::query()->activeAt($now)->with(['products:id', 'categories:id'])->get();

        $options = [];
        foreach ($companies as $company) {
            $base = $company->feeFor($governorate);
            if ($base === null) {
                continue;
            }
            [$fee, $offer] = $freeByCode ? [0, null] : $this->bestOffer($base, $company->id, $governorate, $offers, $basket, $itemsTotal);
            $options[] = [
                'id' => $company->id,
                'name' => $company->name,
                'logo' => $company->logo instanceof Media ? $company->logo->urls() : null,
                'days_min' => $company->delivery_days_min,
                'days_max' => $company->delivery_days_max,
                'original' => $base,
                'fee' => $fee,
                'offer' => $offer?->name,
                'offer_id' => $offer?->id,
            ];
        }

        if ($options === []) {
            return new ShippingQuote(available: false);
        }

        $chosen = null;
        foreach ($options as $option) {
            if ($companyId !== null && $option['id'] === $companyId) {
                $chosen = $option;
            }
        }
        $mismatch = $companyId !== null && $chosen === null;
        if ($chosen === null) {
            // The cheapest for the customer; the merchant's order breaks ties.
            foreach ($options as $option) {
                if ($chosen === null || $option['fee'] < $chosen['fee']) {
                    $chosen = $option;
                }
            }
        }

        return new ShippingQuote(
            fee: $chosen['fee'],
            original: $chosen['original'],
            available: true,
            company: ['id' => $chosen['id'], 'name' => $chosen['name'], 'days_min' => $chosen['days_min'], 'days_max' => $chosen['days_max']],
            offer: $chosen['offer_id'] === null ? null : ['id' => $chosen['offer_id'], 'name' => (string) $chosen['offer']],
            byCode: $freeByCode && $chosen['original'] > 0,
            options: array_map(fn (array $o) => array_diff_key($o, ['offer_id' => true]), $options),
            companyMismatch: $mismatch,
        );
    }

    /**
     * The shipping offer that lowers this company's fee the most (ties → the oldest offer).
     *
     * @param  Collection<int, ShippingOffer>  $offers
     * @return array{0: int, 1: ShippingOffer|null}
     */
    private function bestOffer(int $base, int $companyId, string $governorate, Collection $offers, Basket $basket, int $itemsTotal): array
    {
        $best = [$base, null];
        foreach ($offers->sortBy('id') as $offer) {
            if (! $this->qualifies($offer, $companyId, $governorate, $basket, $itemsTotal)) {
                continue;
            }
            $fee = $offer->benefit->apply($base, $offer->valueCents());
            if ($fee < $best[0]) {
                $best = [$fee, $offer];
            }
        }

        return $best;
    }

    private function qualifies(ShippingOffer $offer, int $companyId, string $governorate, Basket $basket, int $itemsTotal): bool
    {
        if ($offer->governorates !== null && $offer->governorates !== [] && ! in_array($governorate, $offer->governorates, true)) {
            return false;
        }
        if ($offer->company_ids !== null && $offer->company_ids !== [] && ! in_array($companyId, array_map('intval', $offer->company_ids), true)) {
            return false;
        }

        $covered = $basket->covered($offer->applies_to, $offer->products->pluck('id')->all(), $offer->categories->pluck('id')->all());
        if ($covered->isEmpty()) {
            return false;
        }
        if ($offer->min_quantity !== null && $covered->quantity() < $offer->min_quantity) {
            return false;
        }
        // "All products" compares the order after the code (as the old "free over"); a narrower
        // offer compares what the covered products cost.
        $total = $offer->applies_to === PromotionTarget::All ? $itemsTotal : $covered->total();
        $minimum = $offer->minTotalCents();

        return $minimum === null || $total >= $minimum;
    }

    /**
     * What the order form needs to show fees before asking the server (the server quote decides).
     * `fees` / `unavailable` / `free_over` keep the shape older forms read: the cheapest company per
     * governorate, and the simplest "free above" offer.
     *
     * @return array<string, mixed>
     */
    public function publicConfig(CarbonInterface $now): array
    {
        $companies = $this->enabled() ? $this->companies() : new Collection;
        if ($companies->isEmpty()) {
            return ['enabled' => false];
        }

        $fees = [];
        $unavailable = [];
        $perCompany = [];
        foreach ((array) config('landing.governorates') as $governorate) {
            $cheapest = null;
            foreach ($companies as $company) {
                $fee = $company->feeFor($governorate);
                if ($fee === null) {
                    $perCompany[$company->id]['unavailable'][] = $governorate;

                    continue;
                }
                $perCompany[$company->id]['fees'][$governorate] = Money::toFloat($fee);
                $cheapest = $cheapest === null ? $fee : min($cheapest, $fee);
            }
            if ($cheapest === null) {
                $unavailable[] = $governorate;
            } else {
                $fees[$governorate] = Money::toFloat($cheapest);
            }
        }

        $offers = ShippingOffer::query()->activeAt($now)->with(['products:id', 'categories:id'])->orderBy('id')->get();
        $freeOver = $offers->first(fn (ShippingOffer $o) => $o->benefit === ShippingBenefit::Free && $o->applies_to === PromotionTarget::All
            && $o->min_quantity === null && $o->min_total !== null && empty($o->governorates) && empty($o->company_ids));

        return [
            'enabled' => true,
            'fees' => $fees,
            'unavailable' => $unavailable,
            'free_over' => $freeOver === null ? null : Money::toFloat((int) $freeOver->minTotalCents()),
            'companies' => $companies->map(fn (ShippingCompany $c) => [
                'id' => $c->id,
                'name' => $c->name,
                'logo' => $c->logo instanceof Media ? $c->logo->urls() : null,
                'days_min' => $c->delivery_days_min,
                'days_max' => $c->delivery_days_max,
                'fees' => (object) ($perCompany[$c->id]['fees'] ?? []),
                'unavailable' => $perCompany[$c->id]['unavailable'] ?? [],
            ])->values()->all(),
            'offers' => $offers->map(fn (ShippingOffer $o) => [
                'id' => $o->id,
                'name' => $o->name,
                'benefit' => $o->benefit->value,
                'value' => $o->value === null ? null : Money::toFloat($o->valueCents()),
                'min_quantity' => $o->min_quantity,
                'min_total' => $o->min_total === null ? null : Money::toFloat((int) $o->minTotalCents()),
                'applies_to' => $o->applies_to->value,
                'product_ids' => $o->products->pluck('id')->all(),
                'category_ids' => $o->categories->pluck('id')->all(),
                'governorates' => $o->governorates ?? [],
                'company_ids' => array_map('intval', $o->company_ids ?? []),
                'ends_at' => $o->ends_at?->toIso8601ZuluString(),
            ])->values()->all(),
        ];
    }
}
