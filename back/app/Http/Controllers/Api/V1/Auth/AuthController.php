<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Auth;

use App\Actions\Auth\LoginUser;
use App\Actions\Auth\RegisterTenant;
use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\LoginRequest;
use App\Http\Requests\Auth\RegisterRequest;
use App\Http\Resources\DomainResource;
use App\Http\Resources\TenantResource;
use App\Http\Resources\UserResource;
use App\Models\Domain;
use App\Models\User;
use App\Tenancy\Tenancy;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Laravel\Sanctum\PersonalAccessToken;

final class AuthController extends Controller
{
    public function register(RegisterRequest $request, RegisterTenant $action): JsonResponse
    {
        /** @var array{name: string, email: string, phone: string, store_name: string, password: string} $data */
        $data = $request->validated();
        $result = $action->handle($data);

        return $this->created([
            'user' => UserResource::make($result['user'])->resolve($request),
            'tenant' => TenantResource::make($result['tenant'])->resolve($request),
            'domain' => DomainResource::make($result['domain'])->resolve($request),
            'token' => $result['token'],
        ]);
    }

    public function login(LoginRequest $request, LoginUser $action): JsonResponse
    {
        $result = $action->handle((string) $request->validated('login'), (string) $request->validated('password'));
        $user = $result['user'];

        return $this->ok([
            'user' => UserResource::make($user)->resolve($request),
            'tenant' => $user->tenant ? TenantResource::make($user->tenant)->resolve($request) : null,
            'token' => $result['token'],
        ]);
    }

    public function logout(Request $request): Response
    {
        /** @var User $user */
        $user = $request->user();
        $token = $user->currentAccessToken();

        if ($token instanceof PersonalAccessToken) {
            $token->delete();
        }

        return $this->noContent();
    }

    public function me(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $user->loadMissing('tenant');

        $primaryHost = $user->tenant_id === null
            ? null
            : Tenancy::runAs($user->tenant_id, fn (): ?string => Domain::query()->where('is_primary', true)->value('host'));

        return $this->ok([
            'user' => UserResource::make($user)->resolve($request),
            'tenant' => $user->tenant ? TenantResource::make($user->tenant)->resolve($request) : null,
            'primary_host' => $primaryHost,
        ]);
    }
}
