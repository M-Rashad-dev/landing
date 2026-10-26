<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Dashboard;

use App\Exceptions\ApiException;
use App\Http\Controllers\Controller;
use App\Http\Requests\Dashboard\UpdatePasswordRequest;
use App\Http\Requests\Dashboard\UpdateProfileRequest;
use App\Http\Requests\Dashboard\UpdateStoreRequest;
use App\Http\Resources\TenantResource;
use App\Http\Resources\UserResource;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\PersonalAccessToken;

final class AccountController extends Controller
{
    public function updateProfile(UpdateProfileRequest $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $user->fill($request->validated())->save();

        return $this->ok(UserResource::make($user));
    }

    public function updatePassword(UpdatePasswordRequest $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        if (! Hash::check((string) $request->validated('current_password'), $user->password)) {
            throw new ApiException(422, 'validation_failed', __('landing.current_password_wrong'), [
                'current_password' => [__('landing.current_password_wrong')],
            ]);
        }

        $user->forceFill(['password' => (string) $request->validated('password')])->save();

        // Sign out every other session; keep the current token.
        $current = $user->currentAccessToken();
        $user->tokens()
            ->when($current instanceof PersonalAccessToken, fn ($q) => $q->where('id', '!=', $current->getKey()))
            ->delete();

        return $this->ok(['updated' => true]);
    }

    public function updateStore(UpdateStoreRequest $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $tenant = $user->tenant;
        abort_if($tenant === null, 403);

        $tenant->update(['name' => (string) $request->validated('name')]);

        return $this->ok(TenantResource::make($tenant));
    }
}
