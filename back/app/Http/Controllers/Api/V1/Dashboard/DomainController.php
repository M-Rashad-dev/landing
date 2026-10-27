<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Dashboard;

use App\Actions\Domains\AddCustomDomain;
use App\Actions\Domains\ChangeSubdomain;
use App\Actions\Domains\ManageDomain;
use App\Enums\DomainType;
use App\Exceptions\ApiException;
use App\Http\Controllers\Concerns\RespondsWithJson;
use App\Http\Controllers\Controller;
use App\Http\Resources\DomainResource;
use App\Models\Domain;
use App\Services\DomainVerifier;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

final class DomainController extends Controller
{
    use RespondsWithJson;

    public function index(): JsonResponse
    {
        $domains = Domain::query()
            ->orderByRaw('type = ? desc', [DomainType::Subdomain->value])
            ->orderByDesc('is_primary')
            ->orderBy('id')
            ->get();

        return $this->ok(DomainResource::collection($domains), [
            'platform_domain' => (string) config('landing.platform_domain'),
            'custom_limit' => (int) config('landing.limits.custom_domains'),
        ]);
    }

    public function storeCustom(Request $request, AddCustomDomain $action): JsonResponse
    {
        $data = $request->validate(['host' => ['required', 'string', 'max:300']]);

        return $this->created(DomainResource::make($action->handle($data['host'])));
    }

    public function verify(Domain $domain, DomainVerifier $verifier): JsonResponse
    {
        $this->customOnly($domain);

        return $this->ok(DomainResource::make($verifier->verify($domain)));
    }

    public function checkSsl(Domain $domain, ManageDomain $action): JsonResponse
    {
        return $this->ok(DomainResource::make($action->checkSsl($domain)));
    }

    public function makePrimary(Domain $domain, ManageDomain $action): JsonResponse
    {
        return $this->ok(DomainResource::make($action->makePrimary($domain)));
    }

    public function destroy(Domain $domain, ManageDomain $action): Response
    {
        $action->delete($domain);

        return $this->noContent();
    }

    public function updateSubdomain(Request $request, ChangeSubdomain $action): JsonResponse
    {
        $data = $request->validate(['label' => ['required', 'string', 'max:30']]);

        return $this->ok(DomainResource::make($action->handle($data['label'])));
    }

    /** Live availability check for the rename dialog. */
    public function subdomainAvailability(Request $request, ChangeSubdomain $action): JsonResponse
    {
        $label = strtolower(trim((string) $request->query('label', '')));
        $own = Domain::query()->where('type', DomainType::Subdomain)->value('id');
        $error = $action->labelError($label, $own === null ? null : (int) $own);

        return $this->ok([
            'label' => $label,
            'host' => $label.'.'.config('landing.platform_domain'),
            'available' => $error === null,
            'reason' => $error,
        ]);
    }

    private function customOnly(Domain $domain): void
    {
        if ($domain->type !== DomainType::Custom) {
            throw new ApiException(422, 'subdomain_only', __('domains.subdomain_only'));
        }
    }
}
