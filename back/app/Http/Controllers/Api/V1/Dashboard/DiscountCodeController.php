<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Dashboard;

use App\Actions\Promotions\DeleteDiscountCode;
use App\Actions\Promotions\SaveDiscountCode;
use App\Http\Controllers\Api\V1\Dashboard\Concerns\FiltersPromotionStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\Dashboard\DiscountCodeRequest;
use App\Http\Resources\DiscountCodeResource;
use App\Http\Resources\RedemptionResource;
use App\Jobs\RevalidateTenantHosts;
use App\Models\DiscountCode;
use App\Tenancy\Tenancy;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

final class DiscountCodeController extends Controller
{
    use FiltersPromotionStatus;

    public function index(Request $request): JsonResponse
    {
        $search = DiscountCode::normalizeCode((string) $request->query('q', ''));
        $query = DiscountCode::query()
            ->with('products')
            ->when($search !== '', fn ($q) => $q->where('code', 'like', '%'.addcslashes($search, '%_\\').'%'))
            ->latest('id');
        $this->filterStatus($query, $request->query('status'));

        return $this->paginated($query->paginate($this->perPage($request)), DiscountCodeResource::class);
    }

    public function store(DiscountCodeRequest $request, SaveDiscountCode $action): JsonResponse
    {
        $code = $action->handle($request->codeData(), $request->productIds());

        return $this->created(DiscountCodeResource::make($code->load('products'))->resolve($request));
    }

    public function show(DiscountCode $discountCode): JsonResponse
    {
        return $this->ok(DiscountCodeResource::make($discountCode->load('products')));
    }

    public function update(DiscountCodeRequest $request, DiscountCode $discountCode, SaveDiscountCode $action): JsonResponse
    {
        $code = $action->handle($request->codeData(), $request->productIds(), $discountCode);

        return $this->ok(DiscountCodeResource::make($code->load('products')));
    }

    public function destroy(DiscountCode $discountCode, DeleteDiscountCode $action): Response
    {
        $action->handle($discountCode);

        return $this->noContent();
    }

    public function toggle(DiscountCode $discountCode): JsonResponse
    {
        $discountCode->update(['is_active' => ! $discountCode->is_active]);
        RevalidateTenantHosts::dispatch((int) Tenancy::id())->afterCommit();

        return $this->ok(DiscountCodeResource::make($discountCode->load('products')));
    }

    public function redemptions(Request $request, DiscountCode $discountCode): JsonResponse
    {
        $redemptions = $discountCode->redemptions()->latest('id')->paginate($this->perPage($request));

        return $this->paginated($redemptions, RedemptionResource::class);
    }
}
