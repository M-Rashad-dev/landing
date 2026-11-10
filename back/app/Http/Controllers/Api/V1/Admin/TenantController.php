<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Admin;

use App\Actions\Admin\ManageTenant;
use App\Enums\DomainType;
use App\Enums\PageStatus;
use App\Enums\SubscriptionSource;
use App\Enums\TenantStatus;
use App\Enums\UserRole;
use App\Http\Controllers\Concerns\RespondsWithJson;
use App\Http\Controllers\Controller;
use App\Http\Resources\DomainResource;
use App\Models\Tenant;
use App\Models\User;
use App\Tenancy\Tenancy;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Super admin view of tenants. Audited bypass: the admin has no tenant, so every query on
 * tenant tables here runs inside Tenancy::withoutTenant() (allowed for Admin, PLAN 4).
 */
final class TenantController extends Controller
{
    use RespondsWithJson;

    public function index(Request $request): JsonResponse
    {
        $request->validate([
            'q' => ['nullable', 'string', 'max:100'],
            'status' => ['nullable', Rule::enum(TenantStatus::class)],
        ]);
        $search = trim((string) $request->query('q', ''));
        $status = (string) $request->query('status', '');

        $page = Tenancy::withoutTenant(fn () => $this->withSummary(Tenant::query())
            ->when($status !== '', fn (Builder $q) => $q->where('status', $status))
            ->when($search !== '', function (Builder $q) use ($search): void {
                $like = '%'.addcslashes($search, '%_\\').'%';
                $q->where(fn (Builder $w) => $w
                    ->where('name', 'like', $like)
                    ->orWhereHas('users', fn (Builder $u) => $u->where('name', 'like', $like)->orWhere('email', 'like', $like)->orWhere('phone', 'like', $like))
                    ->orWhereHas('domains', fn (Builder $d) => $d->where('host', 'like', $like)));
            })
            ->orderByDesc('id')
            ->paginate($this->perPage($request)));

        return $this->ok(
            $page->getCollection()->map(fn (Tenant $tenant) => $this->row($tenant))->values()->all(),
            ['current_page' => $page->currentPage(), 'last_page' => $page->lastPage(), 'per_page' => $page->perPage(), 'total' => $page->total()],
        );
    }

    public function show(Request $request, int $tenant): JsonResponse
    {
        $model = Tenancy::withoutTenant(fn () => $this->withSummary(Tenant::query())->with(['domains' => fn ($q) => $q->orderByDesc('is_primary')->orderBy('id')])->findOrFail($tenant));

        return $this->ok($this->row($model) + [
            'suspended_at' => $model->suspended_at?->toIso8601ZuluString(),
            'suspended_reason' => $model->suspended_reason,
            'domains' => DomainResource::collection($model->domains)->resolve($request),
        ]);
    }

    public function suspend(Request $request, int $tenant, ManageTenant $action): JsonResponse
    {
        $data = $request->validate(['reason' => ['required', 'string', 'min:3', 'max:500']]);
        $action->suspend(Tenant::query()->findOrFail($tenant), trim(strip_tags($data['reason'])));

        return $this->show($request, $tenant);
    }

    public function activate(Request $request, int $tenant, ManageTenant $action): JsonResponse
    {
        $action->activate(Tenant::query()->findOrFail($tenant));

        return $this->show($request, $tenant);
    }

    public function resetPassword(int $tenant, ManageTenant $action): JsonResponse
    {
        return $this->ok(['temporary_password' => $action->resetPassword(Tenant::query()->findOrFail($tenant))]);
    }

    /**
     * @param  Builder<Tenant>  $query
     * @return Builder<Tenant>
     */
    private function withSummary(Builder $query): Builder
    {
        return $query
            ->with([
                'users' => fn ($q) => $q->where('role', UserRole::Owner)->orderBy('id'),
                'domains' => fn ($q) => $q->orderByDesc('is_primary')->orderBy('id'),
            ])
            ->withCount([
                'pages',
                'pages as published_pages_count' => fn (Builder $q) => $q->where('status', PageStatus::Published),
                'orders',
            ]);
    }

    /** @return array<string, mixed> */
    private function row(Tenant $tenant): array
    {
        /** @var User|null $owner */
        $owner = $tenant->users->first();
        $subdomain = $tenant->domains->firstWhere('type', DomainType::Subdomain);
        $primary = $tenant->domains->firstWhere('is_primary', true);

        return [
            'id' => $tenant->id,
            'name' => $tenant->name,
            'status' => $tenant->status->value,
            'owner' => $owner ? ['id' => $owner->id, 'name' => $owner->name, 'email' => $owner->email, 'phone' => $owner->phone, 'last_login_at' => $owner->last_login_at?->toIso8601ZuluString()] : null,
            'subdomain' => $subdomain?->host,
            'primary_host' => $primary?->host,
            'pages_count' => (int) $tenant->getAttribute('pages_count'),
            'published_pages_count' => (int) $tenant->getAttribute('published_pages_count'),
            'orders_count' => (int) $tenant->getAttribute('orders_count'),
            'plan_key' => $tenant->plan_key,
            'plan_state' => $tenant->accessState()->value,
            'plan_is_trial' => $tenant->plan_source === SubscriptionSource::Trial,
            'plan_ends_at' => $tenant->plan_ends_at?->toIso8601ZuluString(),
            'created_at' => $tenant->created_at?->toIso8601ZuluString(),
        ];
    }
}
