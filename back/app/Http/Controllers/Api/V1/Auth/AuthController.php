<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Auth;

use App\Actions\Auth\LoginUser;
use App\Actions\Auth\PasswordReset;
use App\Actions\Auth\RegisterTenant;
use App\Auth\StaffAccounts;
use App\Billing\Entitlements;
use App\Billing\PlanPresenter;
use App\Exceptions\ApiException;
use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\LoginRequest;
use App\Http\Requests\Auth\PasswordCodeRequest;
use App\Http\Requests\Auth\PasswordResetRequest;
use App\Http\Requests\Auth\RegisterRequest;
use App\Http\Resources\DomainResource;
use App\Http\Resources\TenantResource;
use App\Http\Resources\UserResource;
use App\Models\Domain;
use App\Models\User;
use App\Store\SeoDefaults;
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

    /** "Forgot my password": a code on WhatsApp (the answer is the same whether the account exists or not). */
    public function passwordCode(PasswordCodeRequest $request, PasswordReset $reset): JsonResponse
    {
        return $this->ok($reset->sendCode((string) $request->validated('login'), $request->ip()));
    }

    public function passwordReset(PasswordResetRequest $request, PasswordReset $reset): Response
    {
        $reset->reset((string) $request->validated('login'), (string) $request->validated('code'), (string) $request->validated('password'));

        return $this->noContent();
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

    /** The staff invitation link: whose it is (to greet him), or 410 when it can't be used. */
    public function invitation(Request $request, StaffAccounts $staff): JsonResponse
    {
        $data = $request->validate(['token' => ['required', 'string', 'size:48']]);
        $row = $staff->invitation((string) $data['token']) ?? throw new ApiException(410, 'invitation_invalid', __('staff.link_invalid'));

        return $this->ok(['name' => $row->user->name, 'email' => $row->user->email, 'store' => $row->user->tenant?->name]);
    }

    /** He sets his password from the link and is signed in (same answer as a login). */
    public function acceptInvitation(Request $request, StaffAccounts $staff): JsonResponse
    {
        $data = $request->validate([
            'token' => ['required', 'string', 'size:48'],
            'password' => ['required', 'string', 'min:8', 'max:100', 'confirmed'],
        ]);
        $result = $staff->accept((string) $data['token'], (string) $data['password']);
        $user = $result['user'];

        return $this->ok([
            'user' => UserResource::make($user)->resolve($request),
            'tenant' => $user->tenant ? TenantResource::make($user->tenant)->resolve($request) : null,
            'token' => $result['token'],
        ]);
    }

    public function me(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $user->loadMissing('tenant');

        $primaryHost = $user->tenant_id === null
            ? null
            : Tenancy::runAs($user->tenant_id, fn (): ?string => Domain::query()->where('is_primary', true)->value('host'));
        // The name the store shows its customers (automatic SEO previews in the dashboard).
        $storeName = $user->tenant_id === null ? null : Tenancy::runAs($user->tenant_id, fn (): string => app(SeoDefaults::class)->storeName());

        return $this->ok([
            'user' => UserResource::make($user)->resolve($request),
            'tenant' => $user->tenant ? TenantResource::make($user->tenant)->resolve($request) : null,
            'primary_host' => $primaryHost,
            'store_name' => $storeName,
            'plan' => $user->tenant === null ? null : PlanPresenter::entitlements(app(Entitlements::class)->for($user->tenant)),
        ]);
    }
}
