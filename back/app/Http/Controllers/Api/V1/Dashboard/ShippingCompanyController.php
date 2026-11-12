<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Dashboard;

use App\Actions\Shipping\SaveShippingCompany;
use App\Http\Controllers\Concerns\RespondsWithJson;
use App\Http\Controllers\Controller;
use App\Http\Requests\Dashboard\ShippingCompanyRequest;
use App\Http\Resources\ShippingCompanyResource;
use App\Models\ShippingCompany;
use App\Rules\TenantExists;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

final class ShippingCompanyController extends Controller
{
    use RespondsWithJson;

    public function __construct(private readonly SaveShippingCompany $companies) {}

    public function store(ShippingCompanyRequest $request): JsonResponse
    {
        return $this->created(ShippingCompanyResource::make($this->companies->handle($request->companyData(), $request->rates()))->resolve($request));
    }

    public function show(ShippingCompany $shippingCompany): JsonResponse
    {
        return $this->ok(ShippingCompanyResource::make($shippingCompany->load(['rates', 'logo'])));
    }

    public function update(ShippingCompanyRequest $request, ShippingCompany $shippingCompany): JsonResponse
    {
        return $this->ok(ShippingCompanyResource::make($this->companies->handle($request->companyData(), $request->rates(), $shippingCompany)));
    }

    public function toggle(ShippingCompany $shippingCompany): JsonResponse
    {
        return $this->ok(ShippingCompanyResource::make($this->companies->toggle($shippingCompany)));
    }

    public function destroy(ShippingCompany $shippingCompany): Response
    {
        $this->companies->delete($shippingCompany);

        return $this->noContent();
    }

    public function reorder(Request $request): Response
    {
        $data = $request->validate(['ids' => ['required', 'array', 'max:50'], 'ids.*' => ['integer', 'distinct', TenantExists::table('shipping_companies')]]);
        $this->companies->reorder(array_map('intval', $data['ids']));

        return $this->noContent();
    }
}
