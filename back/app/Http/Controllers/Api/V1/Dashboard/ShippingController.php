<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Dashboard;

use App\Http\Controllers\Concerns\RespondsWithJson;
use App\Http\Controllers\Controller;
use App\Http\Resources\ShippingCompanyResource;
use App\Jobs\RevalidateTenantHosts;
use App\Models\ShippingCompany;
use App\Models\ShippingSetting;
use App\Tenancy\Tenancy;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

/** Store delivery: the on/off switch and the companies with their fees. */
final class ShippingController extends Controller
{
    use RespondsWithJson;

    public function show(): JsonResponse
    {
        return $this->ok($this->payload());
    }

    public function update(Request $request): JsonResponse
    {
        $data = $request->validate(['enabled' => ['required', 'boolean']]);

        if ($data['enabled'] && ! ShippingCompany::query()->where('is_active', true)->exists()) {
            throw ValidationException::withMessages(['enabled' => [__('shipping.needs_company')]]);
        }

        ShippingSetting::query()->updateOrCreate([], ['enabled' => (bool) $data['enabled']]);
        // Public pages show the fees in the order form.
        RevalidateTenantHosts::dispatch((int) Tenancy::id())->afterCommit();

        return $this->ok($this->payload());
    }

    /** @return array<string, mixed> */
    private function payload(): array
    {
        return [
            'enabled' => (bool) ShippingSetting::query()->value('enabled'),
            'governorates' => array_values((array) config('landing.governorates')),
            'companies' => ShippingCompanyResource::collection(
                ShippingCompany::query()->with(['rates', 'logo'])->orderBy('position')->orderBy('id')->get()
            )->resolve(request()),
        ];
    }
}
