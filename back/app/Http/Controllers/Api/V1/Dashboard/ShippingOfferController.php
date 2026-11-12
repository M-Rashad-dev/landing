<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Dashboard;

use App\Actions\Shipping\SaveShippingOffer;
use App\Http\Controllers\Api\V1\Dashboard\Concerns\FiltersPromotionStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\Dashboard\ShippingOfferRequest;
use App\Http\Resources\ShippingOfferResource;
use App\Jobs\RevalidateTenantHosts;
use App\Models\ShippingOffer;
use App\Tenancy\Tenancy;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

final class ShippingOfferController extends Controller
{
    use FiltersPromotionStatus;

    private const WITH = ['products:id,name', 'categories:id,name'];

    public function index(Request $request): JsonResponse
    {
        $search = trim((string) $request->query('q', ''));
        $query = ShippingOffer::query()->with(self::WITH)
            ->when($search !== '', fn ($q) => $q->where('name', 'like', '%'.addcslashes($search, '%_\\').'%'))
            ->latest('id');
        $this->filterStatus($query, $request->query('status'));

        return $this->paginated($query->paginate($this->perPage($request)), ShippingOfferResource::class);
    }

    public function store(ShippingOfferRequest $request, SaveShippingOffer $action): JsonResponse
    {
        $offer = $action->handle($request->offerData(), $request->productIds(), $request->categoryIds());

        return $this->created(ShippingOfferResource::make($offer)->resolve($request));
    }

    public function show(ShippingOffer $shippingOffer): JsonResponse
    {
        return $this->ok(ShippingOfferResource::make($shippingOffer->load(self::WITH)));
    }

    public function update(ShippingOfferRequest $request, ShippingOffer $shippingOffer, SaveShippingOffer $action): JsonResponse
    {
        return $this->ok(ShippingOfferResource::make($action->handle($request->offerData(), $request->productIds(), $request->categoryIds(), $shippingOffer)));
    }

    public function toggle(ShippingOffer $shippingOffer): JsonResponse
    {
        $shippingOffer->update(['is_active' => ! $shippingOffer->is_active]);
        RevalidateTenantHosts::dispatch((int) Tenancy::id())->afterCommit();

        return $this->ok(ShippingOfferResource::make($shippingOffer->load(self::WITH)));
    }

    public function destroy(ShippingOffer $shippingOffer): Response
    {
        $shippingOffer->delete();
        RevalidateTenantHosts::dispatch((int) Tenancy::id())->afterCommit();

        return $this->noContent();
    }
}
