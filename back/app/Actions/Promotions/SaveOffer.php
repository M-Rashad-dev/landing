<?php

declare(strict_types=1);

namespace App\Actions\Promotions;

use App\Billing\Entitlements;
use App\Enums\PlanLimit;
use App\Jobs\RevalidateTenantHosts;
use App\Models\Offer;
use App\Tenancy\Tenancy;
use Illuminate\Support\Facades\DB;

final class SaveOffer
{
    /**
     * @param  array<string, mixed>  $data
     * @param  list<int>  $productIds  when it covers products
     * @param  list<int>  $categoryIds  when it covers categories
     */
    public function handle(array $data, array $productIds, array $categoryIds, ?Offer $offer = null): Offer
    {
        if ($offer === null) {
            app(Entitlements::class)->ensureCanAdd(PlanLimit::Offers);
        }

        $offer = DB::transaction(function () use ($data, $productIds, $categoryIds, $offer): Offer {
            $offer ??= new Offer;
            $offer->fill($data)->save();
            $offer->products()->syncWithPivotValues($productIds, ['tenant_id' => (int) Tenancy::id()]);
            $offer->categories()->sync($categoryIds);

            return $offer;
        });

        RevalidateTenantHosts::dispatch((int) Tenancy::id())->afterCommit();

        return $offer;
    }
}
