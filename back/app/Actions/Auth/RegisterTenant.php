<?php

declare(strict_types=1);

namespace App\Actions\Auth;

use App\Enums\DomainStatus;
use App\Enums\DomainType;
use App\Enums\SslStatus;
use App\Enums\TenantStatus;
use App\Enums\UserRole;
use App\Models\Domain;
use App\Models\Tenant;
use App\Models\User;
use App\Services\SubdomainGenerator;
use App\Tenancy\Tenancy;
use Illuminate\Support\Facades\DB;

final class RegisterTenant
{
    public function __construct(
        private readonly SubdomainGenerator $subdomains,
        private readonly IssueToken $issueToken,
    ) {}

    /**
     * @param  array{name: string, email: string, phone: string, store_name: string, password: string}  $data
     * @return array{user: User, tenant: Tenant, domain: Domain, token: string}
     */
    public function handle(array $data): array
    {
        [$user, $tenant, $domain] = DB::transaction(function () use ($data): array {
            $tenant = Tenant::create([
                'name' => $data['store_name'],
                'status' => TenantStatus::Active,
            ]);

            $user = User::create([
                'tenant_id' => $tenant->id,
                'name' => $data['name'],
                'email' => $data['email'],
                'phone' => $data['phone'],
                'password' => $data['password'],
                'role' => UserRole::Owner,
                'is_active' => true,
                'last_login_at' => now(),
            ]);

            $domain = Tenancy::runAs($tenant->id, function () use ($data): Domain {
                $host = $this->subdomains->host($this->subdomains->generate($data['store_name']));

                $domain = Domain::create([
                    'host' => $host,
                    'type' => DomainType::Subdomain,
                    'status' => DomainStatus::Active,
                    'is_primary' => true,
                    'active_host' => $host,
                    'verified_at' => now(),
                    'ssl_status' => SslStatus::Pending,
                ]);

                $this->afterTenantCreated();

                return $domain;
            });

            return [$user, $tenant, $domain];
        });

        return [
            'user' => $user,
            'tenant' => $tenant,
            'domain' => $domain,
            'token' => $this->issueToken->handle($user),
        ];
    }

    /** Runs inside the new tenant's context. Default identity is added in phase 2. */
    private function afterTenantCreated(): void {}
}
