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
     * @param  list<int>  $productIds
     */
    public function handle(array $data, array $productIds, ?Offer $offer = null): Offer
    {
        if ($offer === null) {
            app(Entitlements::class)->ensureCanAdd(PlanLimit::Offers);
        }

        $offer = DB::transaction(function () use ($data, $productIds, $offer): Offer {
            $offer ??= new Offer;
            $offer->fill($data)->save();
            $offer->products()->syncWithPivotValues($productIds, ['tenant_id' => (int) Tenancy::id()]);

            return $offer;
        });

        RevalidateTenantHosts::dispatch((int) Tenancy::id())->afterCommit();

        return $offer;
    }
}
