<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Dashboard;

use App\Http\Controllers\Concerns\RespondsWithJson;
use App\Http\Controllers\Controller;
use App\Http\Resources\ShippingCompanyResource;
use App\Jobs\RevalidateTenantHosts;
use App\Models\ShippingCompany;
use App\Models\ShippingSetting;
use App\Rules\TenantExists;
use App\Tenancy\Tenancy;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

/** Store delivery: the on/off switch, how checkout picks the company, and the companies with their fees. */
final class ShippingController extends Controller
{
    use RespondsWithJson;

    public function show(): JsonResponse
    {
        return $this->ok($this->payload());
    }

    public function update(Request $request): JsonResponse
    {
        $governorates = (array) config('landing.governorates');
        $data = $request->validate([
            'enabled' => ['required', 'boolean'],
            'company_choice' => ['sometimes', 'string', 'in:'.ShippingSetting::CHOICE_CUSTOMER.','.ShippingSetting::CHOICE_GOVERNORATE],
            'governorate_companies' => ['sometimes', 'nullable', 'array'],
            'governorate_companies.*' => ['nullable', 'integer', TenantExists::table('shipping_companies')],
        ]);

        if ($data['enabled'] && ! ShippingCompany::query()->where('is_active', true)->exists()) {
            throw ValidationException::withMessages(['enabled' => [__('shipping.needs_company')]]);
        }
        $assigned = [];
        foreach ((array) ($data['governorate_companies'] ?? []) as $governorate => $companyId) {
            if (! in_array($governorate, $governorates, true)) {
                throw ValidationException::withMessages(['governorate_companies' => [__('validation.in', ['attribute' => (string) $governorate])]]);
            }
            if ($companyId === null) {
                continue;
            }
            $company = ShippingCompany::query()->with('rates')->find((int) $companyId);
            if ($company === null || ! $company->is_active || $company->feeFor((string) $governorate) === null) {
                throw ValidationException::withMessages(["governorate_companies.{$governorate}" => [__('shipping.governorate_company', ['governorate' => $governorate])]]);
            }
            $assigned[(string) $governorate] = (int) $companyId;
        }

        $values = ['enabled' => (bool) $data['enabled']];
        if (array_key_exists('company_choice', $data)) {
            $values['company_choice'] = $data['company_choice'];
        }
        if (array_key_exists('governorate_companies', $data)) {
            $values['governorate_companies'] = $assigned;
        }
        ShippingSetting::query()->updateOrCreate([], $values);
        // Public pages show the fees in the order form.
        RevalidateTenantHosts::dispatch((int) Tenancy::id())->afterCommit();

        return $this->ok($this->payload());
    }

    /** @return array<string, mixed> */
    private function payload(): array
    {
        $setting = ShippingSetting::query()->first();

        return [
            'enabled' => (bool) $setting?->enabled,
            'company_choice' => $setting->company_choice ?? ShippingSetting::CHOICE_CUSTOMER,
            'governorate_companies' => (object) ($setting->governorate_companies ?? []),
            'governorates' => array_values((array) config('landing.governorates')),
            'companies' => ShippingCompanyResource::collection(
                ShippingCompany::query()->with(['rates', 'logo'])->orderBy('position')->orderBy('id')->get()
            )->resolve(request()),
        ];
    }
}
