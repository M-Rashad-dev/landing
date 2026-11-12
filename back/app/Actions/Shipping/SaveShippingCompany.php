<?php

declare(strict_types=1);

namespace App\Actions\Shipping;

use App\Exceptions\ApiException;
use App\Jobs\RevalidateTenantHosts;
use App\Models\ShippingCompany;
use App\Pricing\Shipping;
use App\Tenancy\Tenancy;
use Illuminate\Support\Facades\DB;

/** Create / edit / switch off / delete / reorder shipping companies (public forms show the fees). */
final class SaveShippingCompany
{
    public function __construct(private readonly Shipping $shipping) {}

    /**
     * @param  array<string, mixed>  $data
     * @param  list<array{governorate: string, fee: string|null, is_available: bool}>  $rates  only the ones that differ
     */
    public function handle(array $data, array $rates, ?ShippingCompany $company = null): ShippingCompany
    {
        if ($company !== null && $company->is_active && ! (bool) $data['is_active']) {
            $this->ensureNotLast($company);
        }

        $company = DB::transaction(function () use ($data, $rates, $company): ShippingCompany {
            if ($company === null) {
                $company = new ShippingCompany(['position' => (int) ShippingCompany::query()->max('position') + 1]);
            }
            $company->fill($data)->save();
            $company->rates()->delete();
            foreach ($rates as $rate) {
                $company->rates()->create($rate);
            }

            return $company;
        });

        $this->revalidate();

        return $company->load(['rates', 'logo']);
    }

    public function toggle(ShippingCompany $company): ShippingCompany
    {
        if ($company->is_active) {
            $this->ensureNotLast($company);
        }
        $company->update(['is_active' => ! $company->is_active]);
        $this->revalidate();

        return $company->load(['rates', 'logo']);
    }

    public function delete(ShippingCompany $company): void
    {
        if ($company->is_active) {
            $this->ensureNotLast($company);
        }
        $company->delete();
        $this->revalidate();
    }

    /** @param list<int> $ids in the new order */
    public function reorder(array $ids): void
    {
        DB::transaction(function () use ($ids): void {
            foreach ($ids as $position => $id) {
                ShippingCompany::query()->whereKey($id)->update(['position' => $position]);
            }
        });
        $this->revalidate();
    }

    /** With shipping on, the store keeps at least one active company (or orders would lose delivery). */
    private function ensureNotLast(ShippingCompany $company): void
    {
        $others = ShippingCompany::query()->where('is_active', true)->whereKeyNot($company->id)->exists();
        if (! $others && $this->shipping->enabled()) {
            throw new ApiException(422, 'last_company', __('shipping.last_company'));
        }
    }

    private function revalidate(): void
    {
        RevalidateTenantHosts::dispatch((int) Tenancy::id())->afterCommit();
    }
}
