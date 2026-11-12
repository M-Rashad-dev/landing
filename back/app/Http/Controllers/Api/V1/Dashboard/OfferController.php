<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Dashboard;

use App\Actions\Promotions\SaveOffer;
use App\Http\Controllers\Api\V1\Dashboard\Concerns\FiltersPromotionStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\Dashboard\OfferRequest;
use App\Http\Resources\OfferResource;
use App\Jobs\RevalidateTenantHosts;
use App\Models\Offer;
use App\Tenancy\Tenancy;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

final class OfferController extends Controller
{
    use FiltersPromotionStatus;

    private const WITH = ['products', 'categories:id,name', 'giftProduct'];

    public function index(Request $request): JsonResponse
    {
        $search = trim((string) $request->query('q', ''));
        $query = Offer::query()->with(self::WITH)
            ->when($search !== '', fn ($q) => $q->where('name', 'like', '%'.addcslashes($search, '%_\\').'%'))
            ->latest('id');
        $this->filterStatus($query, $request->query('status'));

        return $this->paginated($query->paginate($this->perPage($request)), OfferResource::class);
    }

    public function store(OfferRequest $request, SaveOffer $action): JsonResponse
    {
        $offer = $action->handle($request->offerData(), $request->productIds(), $request->categoryIds());

        return $this->created(OfferResource::make($offer->load(self::WITH))->resolve($request));
    }

    public function show(Offer $offer): JsonResponse
    {
        return $this->ok(OfferResource::make($offer->load(self::WITH)));
    }

    public function update(OfferRequest $request, Offer $offer, SaveOffer $action): JsonResponse
    {
        $offer = $action->handle($request->offerData(), $request->productIds(), $request->categoryIds(), $offer);

        return $this->ok(OfferResource::make($offer->load(self::WITH)));
    }

    public function destroy(Offer $offer): Response
    {
        $offer->delete();
        RevalidateTenantHosts::dispatch((int) Tenancy::id())->afterCommit();

        return $this->noContent();
    }

    public function toggle(Offer $offer): JsonResponse
    {
        $offer->update(['is_active' => ! $offer->is_active]);
        RevalidateTenantHosts::dispatch((int) Tenancy::id())->afterCommit();

        return $this->ok(OfferResource::make($offer->load(self::WITH)));
    }
}
