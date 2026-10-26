<?php

declare(strict_types=1);

namespace App\Actions\Promotions;

use App\Exceptions\ApiException;
use App\Jobs\RevalidateTenantHosts;
use App\Models\DiscountCode;
use App\Tenancy\Tenancy;
use Illuminate\Support\Facades\DB;

final class SaveDiscountCode
{
    /**
     * @param  array<string, mixed>  $data
     * @param  list<int>  $productIds  empty = every product
     */
    public function handle(array $data, array $productIds, ?DiscountCode $code = null): DiscountCode
    {
        if ($code === null) {
            $limit = (int) config('landing.limits.discount_codes');
            if (DiscountCode::query()->count() >= $limit) {
                throw new ApiException(422, 'limit_reached', __('promotions.codes_limit', ['limit' => $limit]));
            }
        }

        $code = DB::transaction(function () use ($data, $productIds, $code): DiscountCode {
            $code ??= new DiscountCode;
            $code->fill($data)->save();
            $code->products()->syncWithPivotValues($productIds, ['tenant_id' => (int) Tenancy::id()]);

            return $code;
        });

        RevalidateTenantHosts::dispatch((int) Tenancy::id())->afterCommit();

        return $code;
    }
}
