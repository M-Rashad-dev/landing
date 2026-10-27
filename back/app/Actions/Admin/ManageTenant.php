<?php

declare(strict_types=1);

namespace App\Actions\Admin;

use App\Enums\TenantStatus;
use App\Enums\UserRole;
use App\Exceptions\ApiException;
use App\Jobs\RevalidateTenantHosts;
use App\Models\AdminAuditLog;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Laravel\Sanctum\PersonalAccessToken;

/** Super admin actions on a tenant; each one is written to admin_audit_logs. */
final class ManageTenant
{
    public function __construct(private readonly Request $request) {}

    /** Stops the dashboard (tokens revoked) and the public site (suspended page) at once. */
    public function suspend(Tenant $tenant, string $reason): Tenant
    {
        DB::transaction(function () use ($tenant, $reason): void {
            $tenant->forceFill(['status' => TenantStatus::Suspended, 'suspended_at' => now(), 'suspended_reason' => $reason])->save();
            $this->revokeTokens($tenant->users()->pluck('id')->all());
            $this->audit('tenant.suspend', $tenant, ['reason' => $reason]);
        });

        RevalidateTenantHosts::dispatch($tenant->id);

        return $tenant;
    }

    public function activate(Tenant $tenant): Tenant
    {
        DB::transaction(function () use ($tenant): void {
            $tenant->forceFill(['status' => TenantStatus::Active, 'suspended_at' => null, 'suspended_reason' => null])->save();
            $this->audit('tenant.activate', $tenant);
        });

        RevalidateTenantHosts::dispatch($tenant->id);

        return $tenant;
    }

    /** New 12-character password for the owner, shown once; every session of that user ends. */
    public function resetPassword(Tenant $tenant): string
    {
        $owner = $tenant->users()->where('role', UserRole::Owner)->orderBy('id')->first()
            ?? throw new ApiException(422, 'no_owner', __('admin.no_owner'));

        $password = Str::password(12, letters: true, numbers: true, symbols: true, spaces: false);

        DB::transaction(function () use ($tenant, $owner, $password): void {
            $owner->forceFill(['password' => $password])->save();
            $this->revokeTokens([$owner->id]);
            $this->audit('tenant.reset_password', $tenant, ['user_id' => $owner->id]);
        });

        return $password;
    }

    /** @param  array<string, mixed>  $meta */
    public function audit(string $action, Tenant|string $target, array $meta = [], ?string $targetType = null): void
    {
        AdminAuditLog::query()->create([
            'admin_user_id' => $this->request->user()?->getAuthIdentifier(),
            'action' => $action,
            'target_type' => $targetType ?? 'tenant',
            'target_id' => (string) ($target instanceof Tenant ? $target->id : $target),
            'meta' => $meta === [] ? null : $meta,
            'ip' => $this->request->ip(),
        ]);
    }

    /** @param  list<int>  $userIds */
    private function revokeTokens(array $userIds): void
    {
        PersonalAccessToken::query()
            ->where('tokenable_type', (new User)->getMorphClass())
            ->whereIn('tokenable_id', $userIds)
            ->delete();
    }
}
