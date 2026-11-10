<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Public;

use App\Exceptions\ApiException;
use App\Http\Controllers\Concerns\RespondsWithJson;
use App\Http\Controllers\Controller;
use App\Models\Domain;
use App\Models\LandingPage;
use App\Services\PublicSite;
use App\Tenancy\Tenancy;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Read endpoints Next calls server-side (X-Internal-Key) to render public sites.
 * Responses are never cached here: Next caches them per host with tags.
 */
final class SiteController extends Controller
{
    use RespondsWithJson;

    public function __construct(private readonly PublicSite $site) {}

    public function resolveHost(Request $request): JsonResponse
    {
        $domain = $this->domainOrFail($request);
        $tenant = $domain->tenant;
        // Suspended and expired (unpaid) tenants look the same to visitors: "temporarily unavailable".
        $active = $tenant !== null && $tenant->sitesOpen();
        $primary = $this->site->primaryHost($domain->tenant_id) ?? $domain->host;

        return $this->noStore($this->ok([
            'host' => $domain->host,
            'status' => $active ? 'active' : 'suspended',
            'tenant_active' => $active,
            'primary_host' => $primary,
            'is_primary' => $primary === $domain->host,
            'home_slug' => $active ? Tenancy::runAs($domain->tenant_id, fn () => $this->site->homeSlug()) : null,
        ]));
    }

    public function page(Request $request): JsonResponse
    {
        $domain = $this->activeDomainOrFail($request);
        $slug = mb_strtolower(trim((string) $request->query('slug', '')));

        $payload = Tenancy::runAs($domain->tenant_id, function () use ($domain, $slug) {
            $page = $this->site->page($slug);

            if ($page === null) {
                return null;
            }

            return $this->site->payload($page, $this->site->primaryHost($domain->tenant_id) ?? $domain->host);
        });

        if ($payload === null) {
            throw new ApiException(404, 'page_not_found', __('landing.not_found'));
        }

        return $this->noStore($this->ok($payload));
    }

    public function sitemap(Request $request): JsonResponse
    {
        $domain = $this->activeDomainOrFail($request);
        $primary = $this->site->primaryHost($domain->tenant_id) ?? $domain->host;

        $pages = Tenancy::runAs($domain->tenant_id, fn () => $this->site->publishedPages()
            ->orderByDesc('is_home')
            ->orderBy('id')
            ->get(['id', 'slug', 'is_home', 'seo_override', 'published_at', 'updated_at'])
            ->reject(fn (LandingPage $page) => ($page->seo_override['noindex'] ?? false) === true)
            ->map(fn (LandingPage $page) => [
                'slug' => $page->is_home ? '' : $page->slug,
                'url' => PublicSite::url($primary, $page->is_home ? '' : $page->slug),
                'updated_at' => ($page->published_at ?? $page->updated_at)?->toIso8601ZuluString(),
            ])
            ->values()
            ->all());

        return $this->noStore($this->ok(['primary_host' => $primary, 'pages' => $pages]));
    }

    private function domainOrFail(Request $request): Domain
    {
        $domain = $this->site->domain((string) $request->query('host', ''));

        if ($domain === null) {
            throw new ApiException(404, 'site_not_found', __('landing.not_found'));
        }

        return $domain;
    }

    private function activeDomainOrFail(Request $request): Domain
    {
        return $this->site->activeDomainOrFail((string) $request->query('host', ''));
    }

    private function noStore(JsonResponse $response): JsonResponse
    {
        return $response->header('Cache-Control', 'no-store, private');
    }
}
