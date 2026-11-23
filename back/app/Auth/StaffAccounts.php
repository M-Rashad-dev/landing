<?php

declare(strict_types=1);

namespace App\Auth;

use App\Actions\Auth\IssueToken;
use App\Billing\Entitlements;
use App\Enums\PlanLimit;
use App\Enums\UserRole;
use App\Exceptions\ApiException;
use App\Mail\NotificationMail;
use App\Models\StaffInvitation;
use App\Models\Tenant;
use App\Models\User;
use App\Services\PhoneNormalizer;
use App\Services\PublicSite;
use App\Tenancy\Tenancy;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Throwable;

/**
 * The store's staff (inside the store's tenant): added with their permissions and an email to set their password,
 * edited, stopped, deleted. Nobody can give a permission he doesn't have, and nobody touches the owner.
 */
final class StaffAccounts
{
    public function __construct(private readonly Entitlements $entitlements, private readonly PhoneNormalizer $phones, private readonly IssueToken $tokens) {}

    /** @return Collection<int, User> */
    public function list()
    {
        return User::query()->where('tenant_id', Tenancy::id())->where('role', UserRole::Staff)->with('permissions')->orderBy('id')->get();
    }

    public function find(int $id): User
    {
        return User::query()->where('tenant_id', Tenancy::id())->where('role', UserRole::Staff)->find($id)
            ?? throw new ApiException(404, 'not_found', __('landing.not_found'));
    }

    /** @param array{name: string, email: string, phone: string, permissions: list<string>} $data */
    public function add(User $actor, array $data): User
    {
        $this->entitlements->ensureCanAdd(PlanLimit::StaffAccounts);
        $permissions = $this->allowed($actor, $data['permissions']);

        $user = DB::transaction(function () use ($actor, $data, $permissions): User {
            $user = User::query()->create([
                'tenant_id' => Tenancy::id(),
                'name' => $data['name'],
                'email' => $data['email'],
                'phone' => (string) $this->phones->normalize($data['phone']),
                // Unusable until he sets his own from the link.
                'password' => Str::random(48),
                'role' => UserRole::Staff,
                'is_active' => true,
            ]);
            $user->forceFill(['invited_by' => $actor->id, 'invited_at' => now()])->save();
            $user->syncPermissions($permissions);

            return $user;
        });
        $this->invite($user);

        return $user;
    }

    /** @param array{name?: string, permissions: list<string>} $data */
    public function update(User $actor, User $staff, array $data): User
    {
        $this->guard($actor, $staff);
        $permissions = $this->allowed($actor, $data['permissions']);
        // A permission the actor can't give stays as it was (he can't remove what he can't grant either).
        $kept = $staff->getPermissionNames()->reject(fn (string $p) => $actor->allows($p))->values()->all();
        if (isset($data['name'])) {
            $staff->forceFill(['name' => $data['name']])->save();
        }
        $staff->syncPermissions([...$permissions, ...$kept]);

        return $staff->refresh();
    }

    /** Stop (signs him out everywhere) or resume. */
    public function toggle(User $actor, User $staff): User
    {
        $this->guard($actor, $staff);
        $staff->forceFill(['is_active' => ! $staff->is_active])->save();
        if (! $staff->is_active) {
            $staff->tokens()->delete();
        }

        return $staff;
    }

    public function delete(User $actor, User $staff): void
    {
        $this->guard($actor, $staff);
        $staff->tokens()->delete();
        $staff->delete();
    }

    /** A new «اعمل كلمة السر» link (the old one stops working). */
    public function invite(User $staff): void
    {
        if ($staff->accepted_at !== null) {
            throw new ApiException(422, 'already_joined', __('staff.already_joined'));
        }
        $token = Str::random(48);
        StaffInvitation::query()->where('user_id', $staff->id)->whereNull('used_at')->delete();
        StaffInvitation::query()->create(['user_id' => $staff->id, 'token_hash' => hash('sha256', $token), 'expires_at' => now()->addHours(StaffInvitation::HOURS)]);

        $store = (string) Tenant::query()->whereKey($staff->tenant_id)->value('name');
        try {
            Mail::to($staff->email)->send(new NotificationMail(
                'staff_invitation',
                (string) __('staff.mail.subject', ['store' => $store]),
                (string) __('staff.mail.intro', ['name' => $staff->name, 'store' => $store, 'hours' => StaffInvitation::HOURS]),
                [['label' => (string) __('staff.mail.login'), 'value' => (string) $staff->email]],
                (string) __('staff.mail.action'),
                rtrim(PublicSite::url((string) config('landing.app_host')), '/').'/invite/'.$token,
                $store,
            ));
        } catch (Throwable $e) {
            report($e);
        }
        $staff->forceFill(['invited_at' => now()])->save();
    }

    /** Who the link is for (the page shows his name and email), or null. */
    public function invitation(string $token): ?StaffInvitation
    {
        $row = StaffInvitation::query()->where('token_hash', hash('sha256', $token))->with('user.tenant')->first();

        return $row === null || $row->used_at !== null || $row->expires_at->isPast() || $row->user === null || ! $row->user->is_active ? null : $row;
    }

    /** He sets his password from the link: signed in. @return array{user: User, token: string} */
    public function accept(string $token, string $password): array
    {
        return DB::transaction(function () use ($token, $password): array {
            $row = $this->invitation($token) ?? throw new ApiException(410, 'invitation_invalid', __('staff.link_invalid'));
            $user = $row->user;
            $row->forceFill(['used_at' => now()])->save();
            $user->forceFill(['password' => $password, 'accepted_at' => now(), 'last_login_at' => now()])->save();

            return ['user' => $user, 'token' => $this->tokens->handle($user)];
        });
    }

    /**
     * The permissions asked for, each one in the catalog and held by the actor.
     *
     * @param  list<string>  $asked
     * @return list<string>
     */
    private function allowed(User $actor, array $asked): array
    {
        $asked = array_values(array_unique($asked));
        foreach ($asked as $key) {
            if (! PermissionCatalog::exists($key)) {
                throw ValidationException::withMessages(['permissions' => [__('staff.unknown_permission')]]);
            }
            if (! $actor->allows($key)) {
                throw ValidationException::withMessages(['permissions' => [__('staff.cant_grant', ['permission' => PermissionCatalog::label($key)])]]);
            }
        }

        return $asked;
    }

    private function guard(User $actor, User $staff): void
    {
        if ($staff->id === $actor->id) {
            throw new ApiException(422, 'not_yourself', __('staff.not_yourself'));
        }
    }
}
