<?php

declare(strict_types=1);

namespace App\Actions\Promotions;

use App\Billing\Entitlements;
use App\Enums\PlanLimit;
use App\Jobs\RevalidateTenantHosts;
use App\Models\DiscountCode;
use App\Tenancy\Tenancy;
use Illuminate\Support\Facades\DB;

final class SaveDiscountCode
{
    /**
     * @param  array<string, mixed>  $data
     * @param  list<int>  $productIds  when it covers products
     * @param  list<int>  $categoryIds  when it covers categories
     */
    public function handle(array $data, array $productIds, array $categoryIds, ?DiscountCode $code = null): DiscountCode
    {
        if ($code === null) {
            app(Entitlements::class)->ensureCanAdd(PlanLimit::DiscountCodes);
        }

        $code = DB::transaction(function () use ($data, $productIds, $categoryIds, $code): DiscountCode {
            $code ??= new DiscountCode;
            $code->fill($data)->save();
            $code->products()->syncWithPivotValues($productIds, ['tenant_id' => (int) Tenancy::id()]);
            $code->categories()->sync($categoryIds);

            return $code;
        });

        RevalidateTenantHosts::dispatch((int) Tenancy::id())->afterCommit();

        return $code;
    }
}
