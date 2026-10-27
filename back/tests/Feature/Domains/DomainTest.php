<?php

declare(strict_types=1);

use App\Enums\DomainStatus;
use App\Enums\DomainType;
use App\Enums\SslStatus;
use App\Enums\TenantStatus;
use App\Jobs\RevalidateTenantHosts;
use App\Jobs\VerifyDomain;
use App\Jobs\WarmSsl;
use App\Models\Domain;
use App\Models\Tenant;
use App\Models\User;
use App\Services\Dns\DnsResolver;
use App\Services\DomainRules;
use App\Services\DomainVerifier;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;

/** DNS answers per host: ['cname' => [...], 'a' => [...]]. */
function fakeDns(array $answers): void
{
    app()->instance(DnsResolver::class, new class($answers) implements DnsResolver
    {
        public function __construct(private array $answers) {}

        public function cnameTargets(string $host): array
        {
            return $this->answers[$host]['cname'] ?? [];
        }

        public function ipv4(string $host): array
        {
            return $this->answers[$host]['a'] ?? [];
        }
    });
}

function domainOf(User $user, string $host): Domain
{
    return asTenant($user, fn () => Domain::query()->where('host', $host)->firstOrFail());
}

beforeEach(function () {
    Queue::fake();
    fakeDns([]);
    $this->user = actingAsOwner();
});

it('normalizes hosts', function (string $input, string $expected) {
    expect(DomainRules::normalize($input))->toBe($expected);
})->with([
    'case + scheme + path' => ['HTTPS://Shop.Example.COM/offer?x=1', 'shop.example.com'],
    'port + trailing dot' => ['example.com.:8080', 'example.com'],
    'trailing dot' => ['www.example.com.', 'www.example.com'],
    'spaces + user info' => ['  http://user@example.net/  ', 'example.net'],
    'arabic' => ['متجر.مصر', 'xn--pgbep1f.xn--wgbh1c'],
    'arabic with path' => ['https://متجر.مصر/عرض', 'xn--pgbep1f.xn--wgbh1c'],
]);

it('converts Arabic domains to punycode and back', function () {
    $ascii = DomainRules::normalize('متجر.مصر');
    expect($ascii)->toStartWith('xn--')->and(idn_to_utf8($ascii, IDNA_NONTRANSITIONAL_TO_UNICODE, INTL_IDNA_VARIANT_UTS46))->toBe('متجر.مصر');
});

it('rejects bad hosts with Arabic messages', function (string $host, string $key) {
    $this->postJson('/api/v1/dashboard/domains/custom', ['host' => $host])
        ->assertStatus(422)
        ->assertJsonPath('errors.host.0', __($key));
})->with([
    'ip' => ['41.33.2.1', 'domains.host_ip'],
    'localhost' => ['localhost', 'domains.host_localhost'],
    'platform itself' => ['platform.test', 'domains.host_platform'],
    'platform subdomain' => ['shop.platform.test', 'domains.host_platform'],
    'no dot' => ['example', 'domains.host_needs_dot'],
    'long label' => [str_repeat('a', 64).'.com', 'domains.host_invalid'],
    'bad chars' => ['shop_.example.com', 'domains.host_invalid'],
    'too long' => [implode('.', array_fill(0, 55, 'abcd')).'.com', 'domains.host_too_long'],
]);

it('rejects a host active at another tenant and duplicates in the same account', function () {
    asTenant(createOwner(), fn () => Domain::factory()->custom('taken.com', DomainStatus::Active)->create());

    $this->postJson('/api/v1/dashboard/domains/custom', ['host' => 'Taken.com'])->assertStatus(422)->assertJsonPath('errors.host.0', __('domains.host_taken'));

    $this->postJson('/api/v1/dashboard/domains/custom', ['host' => 'mine.com'])->assertCreated();
    $this->postJson('/api/v1/dashboard/domains/custom', ['host' => 'https://mine.com/'])->assertStatus(422)->assertJsonPath('errors.host.0', __('domains.host_already_added'));
});

it('limits custom domains per tenant', function () {
    config(['landing.limits.custom_domains' => 2]);
    $this->postJson('/api/v1/dashboard/domains/custom', ['host' => 'a.com'])->assertCreated();
    $this->postJson('/api/v1/dashboard/domains/custom', ['host' => 'b.com'])->assertCreated();
    $this->postJson('/api/v1/dashboard/domains/custom', ['host' => 'c.com'])->assertStatus(422)->assertJsonPath('code', 'limit_reached');
});

it('gives the right DNS record for root and sub domains', function () {
    $root = $this->postJson('/api/v1/dashboard/domains/custom', ['host' => 'example.com'])->assertCreated();
    $root->assertJsonPath('data.status', 'pending')
        ->assertJsonPath('data.instructions.kind', 'root')
        ->assertJsonPath('data.instructions.record', ['type' => 'A', 'name' => '@', 'value' => '203.0.113.10'])
        ->assertJsonPath('data.instructions.cloudflare_warning', __('domains.cloudflare_warning'))
        ->assertJsonPath('data.last_check_error', __('domains.record_not_found'))
        ->assertJsonPath('data.check_attempts', 1);

    $this->postJson('/api/v1/dashboard/domains/custom', ['host' => 'www.shop.com.eg'])
        ->assertJsonPath('data.instructions.kind', 'subdomain')
        ->assertJsonPath('data.instructions.zone', 'shop.com.eg')
        ->assertJsonPath('data.instructions.record', ['type' => 'CNAME', 'name' => 'www', 'value' => 'cname.platform.test']);

    $this->postJson('/api/v1/dashboard/domains/custom', ['host' => 'shop.com.eg'])->assertJsonPath('data.instructions.record.type', 'A');

    $list = $this->getJson('/api/v1/dashboard/domains')->assertOk();
    $list->assertJsonPath('data.0.type', 'subdomain')->assertJsonPath('data.0.instructions', null)->assertJsonPath('meta.platform_domain', 'platform.test');
    expect($list->json('data'))->toHaveCount(4);
});

it('verifies by CNAME, by A record and reports wrong or missing records', function () {
    fakeDns([
        'shop.cname-ok.com' => ['cname' => ['cname.platform.test'], 'a' => ['203.0.113.10']],
        'a-ok.com' => ['a' => ['203.0.113.10', '203.0.113.11']],
        'a-wrong.com' => ['a' => ['198.51.100.7']],
        'shop.cname-wrong.com' => ['cname' => ['shops.myshopify.com']],
    ]);
    $verifier = app(DomainVerifier::class);

    expect($verifier->check('shop.cname-ok.com'))->toBeNull()
        ->and($verifier->check('a-ok.com'))->toBeNull()
        ->and($verifier->check('a-wrong.com'))->toBe(__('domains.points_elsewhere', ['value' => '198.51.100.7']))
        ->and($verifier->check('shop.cname-wrong.com'))->toBe(__('domains.points_elsewhere', ['value' => 'shops.myshopify.com']))
        ->and($verifier->check('nothing.com'))->toBe(__('domains.record_not_found'));
});

it('activates on success, warms SSL and revalidates', function () {
    fakeDns(['example.com' => ['a' => ['203.0.113.10']]]);

    $this->postJson('/api/v1/dashboard/domains/custom', ['host' => 'example.com'])
        ->assertCreated()
        ->assertJsonPath('data.status', 'active')
        ->assertJsonPath('data.last_check_error', null);

    $domain = domainOf($this->user, 'example.com');
    expect($domain->active_host)->toBe('example.com')->and($domain->verified_at)->not->toBeNull();
    Queue::assertPushed(WarmSsl::class, fn (WarmSsl $job) => $job->domainId === $domain->id);
    Queue::assertPushed(RevalidateTenantHosts::class);
});

it('re-verifies on demand and keeps the last error', function () {
    $id = $this->postJson('/api/v1/dashboard/domains/custom', ['host' => 'later.com'])->json('data.id');

    $this->postJson("/api/v1/dashboard/domains/{$id}/verify")->assertOk()->assertJsonPath('data.status', 'pending')->assertJsonPath('data.check_attempts', 2);

    fakeDns(['later.com' => ['a' => ['203.0.113.10']]]);
    $this->postJson("/api/v1/dashboard/domains/{$id}/verify")->assertOk()->assertJsonPath('data.status', 'active');

    // The free subdomain has nothing to verify.
    $sub = asTenant($this->user, fn () => Domain::query()->where('type', DomainType::Subdomain)->value('id'));
    $this->postJson("/api/v1/dashboard/domains/{$sub}/verify")->assertStatus(422);
});

it('lets only one of two accounts activate the same host', function () {
    $other = createOwner();
    $mine = asTenant($this->user, fn () => Domain::factory()->custom('race.com')->create());
    $theirs = asTenant($other, fn () => Domain::factory()->custom('race.com')->create());
    fakeDns(['race.com' => ['a' => ['203.0.113.10']]]);
    $verifier = app(DomainVerifier::class);

    asTenant($other, fn () => $verifier->verify($theirs));
    asTenant($this->user, fn () => $verifier->verify($mine));

    expect($theirs->fresh()->status)->toBe(DomainStatus::Active)
        ->and(asTenant($this->user, fn () => $mine->fresh()))
        ->status->toBe(DomainStatus::Pending)
        ->last_check_error->toBe(__('domains.host_taken'))
        ->active_host->toBeNull();

    // The database refuses a second active row for the same host as a last line of defence.
    expect(fn () => asTenant($this->user, fn () => $mine->fresh()->forceFill(['active_host' => 'race.com'])->save()))
        ->toThrow(UniqueConstraintViolationException::class);
});

it('rate limits manual checks to 10 per minute', function () {
    $id = $this->postJson('/api/v1/dashboard/domains/custom', ['host' => 'slow.com'])->json('data.id');
    for ($i = 0; $i < 10; $i++) {
        $this->postJson("/api/v1/dashboard/domains/{$id}/verify")->assertOk();
    }
    $this->postJson("/api/v1/dashboard/domains/{$id}/verify")->assertStatus(429);
});

it('answers the Caddy TLS ask for platform and active hosts only', function () {
    $suspended = Tenant::factory()->create(['status' => TenantStatus::Suspended]);
    asTenant($suspended, fn () => Domain::factory()->custom('suspended.com', DomainStatus::Active)->create());
    asTenant($this->user, fn () => Domain::factory()->custom('active.com', DomainStatus::Active)->create());
    asTenant($this->user, fn () => Domain::factory()->custom('pending.com')->create());
    $sub = asTenant($this->user, fn () => Domain::query()->where('type', DomainType::Subdomain)->value('host'));

    foreach (['platform.test', 'app.platform.test', 'cname.platform.test', 'active.com', 'ACTIVE.com', $sub] as $host) {
        $this->get('/internal/tls/ask?domain='.urlencode($host))->assertOk();
    }
    foreach (['pending.com', 'suspended.com', 'unknown.com', 'evil.platform.test', ''] as $host) {
        $this->get('/internal/tls/ask?domain='.urlencode($host))->assertNotFound();
    }
    $this->get('/internal/tls/ask')->assertNotFound();

    // Read only.
    expect(asTenant($this->user, fn () => Domain::query()->where('host', 'pending.com')->first()->check_attempts))->toBe(0);
});

it('verifies pending domains on schedule and fails the expired ones', function () {
    $fresh = asTenant($this->user, fn () => Domain::factory()->custom('fresh.com')->create());
    $old = asTenant($this->user, fn () => Domain::factory()->custom('old.com')->create(['created_at' => now()->subHours(73)]));
    $active = asTenant($this->user, fn () => Domain::factory()->custom('done.com', DomainStatus::Active)->create());

    $this->artisan('domains:verify-pending')->assertSuccessful();

    Queue::assertPushed(VerifyDomain::class, 1);
    Queue::assertPushed(VerifyDomain::class, fn (VerifyDomain $job) => $job->domainId === $fresh->id);
    expect(asTenant($this->user, fn () => $old->fresh()->status))->toBe(DomainStatus::Failed)
        ->and(asTenant($this->user, fn () => $active->fresh()->status))->toBe(DomainStatus::Active);

    // The queued job runs the check inside the domain's tenant.
    fakeDns(['fresh.com' => ['cname' => ['cname.platform.test']]]);
    (new VerifyDomain($fresh->id))->handle(app(DomainVerifier::class));
    expect(asTenant($this->user, fn () => $fresh->fresh()->status))->toBe(DomainStatus::Active);
});

it('records SSL as issued when the host answers over https, unknown after the last try', function () {
    $domain = asTenant($this->user, fn () => Domain::factory()->custom('ssl.com', DomainStatus::Active)->create());
    config(['landing.public_scheme' => 'https', 'landing.public_port' => null]);

    Http::fake(['https://ssl.com/api/health' => Http::response(['ok' => true])]);
    (new WarmSsl($domain->id))->handle();
    expect(asTenant($this->user, fn () => $domain->fresh()->ssl_status))->toBe(SslStatus::Issued);

    $down = asTenant($this->user, fn () => Domain::factory()->custom('down.com', DomainStatus::Active)->create());
    Http::fake(['https://down.com/*' => Http::response('', 502)]);
    // Not the last try yet: released for 20 s, status untouched.
    $job = (new WarmSsl($down->id))->withFakeQueueInteractions();
    $job->handle();
    $job->assertReleased(WarmSsl::DELAY_SECONDS);
    expect(asTenant($this->user, fn () => $down->fresh()->ssl_status))->toBe(SslStatus::Pending);

    $job = (new WarmSsl($down->id))->withFakeQueueInteractions();
    $job->job->attempts = WarmSsl::ATTEMPTS;
    $job->handle();
    expect(asTenant($this->user, fn () => $down->fresh()->ssl_status))->toBe(SslStatus::Unknown);

    $this->postJson("/api/v1/dashboard/domains/{$domain->id}/check-ssl")->assertOk()->assertJsonPath('data.ssl_status', 'pending');
    Queue::assertPushed(WarmSsl::class);
});

it('renames the free subdomain and releases the old name', function () {
    $sub = asTenant($this->user, fn () => Domain::query()->where('type', DomainType::Subdomain)->first());
    $oldHost = $sub->host;

    $this->getJson('/api/v1/dashboard/domains/subdomain/availability?label=my-shop')->assertOk()->assertJsonPath('data.available', true)->assertJsonPath('data.host', 'my-shop.platform.test');
    $this->getJson('/api/v1/dashboard/domains/subdomain/availability?label=admin')->assertJsonPath('data.available', false)->assertJsonPath('data.reason', __('domains.label_reserved'));
    $this->getJson('/api/v1/dashboard/domains/subdomain/availability?label=-bad')->assertJsonPath('data.reason', __('domains.label_invalid'));

    $this->putJson('/api/v1/dashboard/domains/subdomain', ['label' => 'My-Shop'])->assertOk()->assertJsonPath('data.host', 'my-shop.platform.test');
    expect(asTenant($this->user, fn () => $sub->fresh()->active_host))->toBe('my-shop.platform.test');
    Queue::assertPushed(RevalidateTenantHosts::class, fn (RevalidateTenantHosts $job) => $job->extraHosts === [$oldHost]);

    // The old name is free for someone else; the new one is not.
    $other = actingAsOwner(createOwner());
    $this->getJson('/api/v1/dashboard/domains/subdomain/availability?label='.explode('.', $oldHost)[0])->assertJsonPath('data.available', true);
    $this->putJson('/api/v1/dashboard/domains/subdomain', ['label' => 'my-shop'])->assertStatus(422)->assertJsonPath('errors.label.0', __('domains.label_taken'));
    expect($other->id)->not->toBe($this->user->id);
});

it('keeps exactly one primary and hands it back to the subdomain on delete', function () {
    $custom = asTenant($this->user, fn () => Domain::factory()->custom('brand.com', DomainStatus::Active)->create());
    $pending = asTenant($this->user, fn () => Domain::factory()->custom('soon.com')->create());

    $this->postJson("/api/v1/dashboard/domains/{$pending->id}/make-primary")->assertStatus(422)->assertJsonPath('code', 'domain_not_active');
    $this->postJson("/api/v1/dashboard/domains/{$custom->id}/make-primary")->assertOk()->assertJsonPath('data.is_primary', true);

    $primaries = fn () => asTenant($this->user, fn () => Domain::query()->where('is_primary', true)->pluck('host')->all());
    expect($primaries())->toBe(['brand.com']);
    $this->getJson('/api/v1/auth/me')->assertJsonPath('data.primary_host', 'brand.com');

    // The old subdomain now redirects to the custom domain.
    $sub = asTenant($this->user, fn () => Domain::query()->where('type', DomainType::Subdomain)->value('host'));
    $this->getJson('/api/v1/public/resolve-host?host='.$sub, internalHeaders())
        ->assertOk()
        ->assertJsonPath('data.is_primary', false)
        ->assertJsonPath('data.primary_host', 'brand.com');

    $this->deleteJson("/api/v1/dashboard/domains/{$custom->id}")->assertNoContent();
    expect($primaries())->toBe([$sub]);
    Queue::assertPushed(RevalidateTenantHosts::class, fn (RevalidateTenantHosts $job) => $job->extraHosts === ['brand.com']);

    $subId = asTenant($this->user, fn () => Domain::query()->where('type', DomainType::Subdomain)->value('id'));
    $this->deleteJson("/api/v1/dashboard/domains/{$subId}")->assertStatus(422)->assertJsonPath('code', 'subdomain_delete');
});

it('returns 401 without a token', function (string $method, string $uri) {
    app('auth')->forgetGuards();

    $this->json($method, $uri)->assertUnauthorized()->assertJsonPath('code', 'unauthenticated');
})->with([
    ['GET', '/api/v1/dashboard/domains'],
    ['POST', '/api/v1/dashboard/domains/custom'],
    ['PUT', '/api/v1/dashboard/domains/subdomain'],
    ['GET', '/api/v1/dashboard/domains/subdomain/availability'],
    ['POST', '/api/v1/dashboard/domains/1/verify'],
    ['POST', '/api/v1/dashboard/domains/1/check-ssl'],
    ['POST', '/api/v1/dashboard/domains/1/make-primary'],
    ['DELETE', '/api/v1/dashboard/domains/1'],
]);
