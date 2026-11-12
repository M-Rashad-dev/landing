<?php

declare(strict_types=1);

namespace App\Actions\Shipping;

use App\Jobs\RevalidateTenantHosts;
use App\Models\ShippingOffer;
use App\Tenancy\Tenancy;
use Illuminate\Support\Facades\DB;

final class SaveShippingOffer
{
    /**
     * @param  array<string, mixed>  $data
     * @param  list<int>  $productIds  when it covers products
     * @param  list<int>  $categoryIds  when it covers categories
     */
    public function handle(array $data, array $productIds, array $categoryIds, ?ShippingOffer $offer = null): ShippingOffer
    {
        $offer = DB::transaction(function () use ($data, $productIds, $categoryIds, $offer): ShippingOffer {
            $offer ??= new ShippingOffer;
            $offer->fill($data)->save();
            $offer->products()->sync($productIds);
            $offer->categories()->sync($categoryIds);

            return $offer;
        });

        RevalidateTenantHosts::dispatch((int) Tenancy::id())->afterCommit();

        return $offer->load(['products:id,name', 'categories:id,name']);
    }
}
