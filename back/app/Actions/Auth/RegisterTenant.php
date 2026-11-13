<?php

declare(strict_types=1);

namespace App\Actions\Auth;

use App\Billing\SubscriptionManager;
use App\Enums\DomainStatus;
use App\Enums\DomainType;
use App\Enums\SslStatus;
use App\Enums\TenantStatus;
use App\Enums\UserRole;
use App\Models\Domain;
use App\Models\Identity;
use App\Models\Tenant;
use App\Models\User;
use App\Services\AdminAlerts;
use App\Services\SubdomainGenerator;
use App\Tenancy\Tenancy;
use Illuminate\Support\Facades\DB;

final class RegisterTenant
{
    public function __construct(
        private readonly SubdomainGenerator $subdomains,
        private readonly IssueToken $issueToken,
        private readonly SubscriptionManager $subscriptions,
        private readonly AdminAlerts $alerts,
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

                $this->createDefaultIdentity($data['store_name']);

                return $domain;
            });

            return [$user, $tenant, $domain];
        });

        // Free trial when the admin has it on; otherwise the dashboard opens on the pricing page.
        $this->subscriptions->startTrial($tenant);
        $this->alerts->storeRegistered($tenant, $user, $domain->host);

        return [
            'user' => $user,
            'tenant' => $tenant,
            'domain' => $domain,
            'token' => $this->issueToken->handle($user),
        ];
    }

    /** Runs inside the new tenant's context. */
    private function createDefaultIdentity(string $storeName): void
    {
        $identity = new Identity([
            'name' => mb_substr($storeName, 0, 60),
            'brand_name' => mb_substr($storeName, 0, 60),
            'colors' => config('landing.default_colors'),
            'font_heading' => 'cairo',
            'font_body' => 'cairo',
            'button_radius' => 'md',
            'contact' => [],
            'socials' => [],
            'tracking' => ['conversion_event' => 'Purchase'],
        ]);
        $identity->is_default = true;
        $identity->save();
    }
}
