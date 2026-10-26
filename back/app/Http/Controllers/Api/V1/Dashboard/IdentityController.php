<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Dashboard;

use App\Actions\Identities\DeleteIdentity;
use App\Actions\Identities\MakeIdentityDefault;
use App\Actions\Identities\SaveIdentity;
use App\Http\Controllers\Controller;
use App\Http\Requests\Dashboard\IdentityRequest;
use App\Http\Resources\IdentityResource;
use App\Models\Identity;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

final class IdentityController extends Controller
{
    private const RELATIONS = ['logo', 'favicon', 'ogImage'];

    public function index(Request $request): JsonResponse
    {
        $identities = Identity::query()
            ->with(self::RELATIONS)
            ->orderByDesc('is_default')
            ->latest('id')
            ->paginate($this->perPage($request));

        return $this->paginated($identities, IdentityResource::class);
    }

    public function store(IdentityRequest $request, SaveIdentity $action): JsonResponse
    {
        $identity = $action->handle($request->identityData());

        return $this->created(IdentityResource::make($identity->load(self::RELATIONS))->resolve($request));
    }

    public function show(Identity $identity): JsonResponse
    {
        return $this->ok(IdentityResource::make($identity->load(self::RELATIONS)));
    }

    public function update(IdentityRequest $request, Identity $identity, SaveIdentity $action): JsonResponse
    {
        $identity = $action->handle($request->identityData(), $identity);

        return $this->ok(IdentityResource::make($identity->load(self::RELATIONS)));
    }

    public function makeDefault(Identity $identity, MakeIdentityDefault $action): JsonResponse
    {
        return $this->ok(IdentityResource::make($action->handle($identity)->load(self::RELATIONS)));
    }

    public function destroy(Identity $identity, DeleteIdentity $action): Response
    {
        $action->handle($identity);

        return $this->noContent();
    }
}
