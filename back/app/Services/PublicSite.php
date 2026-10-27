<?php

declare(strict_types=1);

namespace App\Services;

use App\Enums\DomainStatus;
use App\Enums\PageStatus;
use App\Exceptions\ApiException;
use App\Models\Domain;
use App\Models\Identity;
use App\Models\LandingPage;
use App\Models\Media;
use App\Models\Tenant;
use App\Support\PlainText;
use App\Support\TrackingIds;
use App\Tenancy\Tenancy;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\Cache;

/**
 * Host → tenant → published page, for the visitor-facing API.
 * Only active domains match (pending/failed custom domains never serve pages).
 */
final class PublicSite
{
    public function __construct(private readonly PublicPageData $data) {}

    /** Host lookups are cached briefly; Domain / Tenant model events clear them on every change. */
    public const CACHE_SECONDS = 60;

    public function domain(string $host): ?Domain
    {
        $host = mb_strtolower(trim($host));

        if ($host === '' || mb_strlen($host) > 253) {
            return null;
        }

        // Plain arrays in the cache (object unserialization is disabled); unknown hosts are cached too.
        $row = Cache::remember(self::hostKey($host), self::CACHE_SECONDS, function () use ($host): array {
            // Audited bypass: the tenant is unknown until the host is resolved.
            $domain = Tenancy::withoutTenant(fn () => Domain::query()
                ->with('tenant')
                ->where('active_host', $host)
                ->where('status', DomainStatus::Active)
                ->first());

            return $domain === null ? [] : ['domain' => $domain->getAttributes(), 'tenant' => $domain->tenant?->getAttributes()];
        });

        if ($row === []) {
            return null;
        }

        $domain = (new Domain)->newFromBuilder($row['domain']);
        $domain->setRelation('tenant', $row['tenant'] === null ? null : (new Tenant)->newFromBuilder($row['tenant']));

        return $domain;
    }

    public static function hostKey(string $host): string
    {
        return 'site:host:'.mb_strtolower($host);
    }

    public static function primaryKey(int $tenantId): string
    {
        return 'site:primary:'.$tenantId;
    }

    /**
     * Drops cached lookups for some hosts and for the tenant's primary host.
     *
     * @param  array<int, string|null>  $hosts
     */
    public static function forget(array $hosts, ?int $tenantId = null): void
    {
        foreach (array_unique(array_filter($hosts)) as $host) {
            Cache::forget(self::hostKey((string) $host));
        }
        if ($tenantId !== null) {
            Cache::forget(self::primaryKey($tenantId));
        }
    }

    /** Active domain of an active tenant, or a 404 (suspended tenants serve nothing). */
    public function activeDomainOrFail(string $host): Domain
    {
        $domain = $this->domain($host);

        if ($domain === null || $domain->tenant === null || ! $domain->tenant->isActive()) {
            throw new ApiException(404, 'site_not_found', __('landing.not_found'));
        }

        return $domain;
    }

    /** Published page by slug in the current tenant, or a 404. */
    public function pageOrFail(string $slug): LandingPage
    {
        return $this->page(mb_strtolower(trim($slug))) ?? throw new ApiException(404, 'page_not_found', __('landing.not_found'));
    }

    public function primaryHost(int $tenantId): ?string
    {
        $host = Cache::remember(self::primaryKey($tenantId), self::CACHE_SECONDS, fn (): string => (string) Tenancy::withoutTenant(
            // Audited bypass: explicitly filtered to this tenant's id.
            fn () => Domain::query()
                ->where('tenant_id', $tenantId)
                ->where('status', DomainStatus::Active)
                ->where('is_primary', true)
                ->value('host'),
        ));

        return $host === '' ? null : $host;
    }

    /** Published pages of the current tenant. @return Builder<LandingPage> */
    public function publishedPages(): Builder
    {
        return LandingPage::query()->where('status', PageStatus::Published)->whereNotNull('published_content');
    }

    public function homeSlug(): ?string
    {
        return $this->publishedPages()->where('is_home', true)->value('slug');
    }

    /** Empty slug → the home page. Never returns drafts. */
    public function page(string $slug): ?LandingPage
    {
        $query = $this->publishedPages()->with(['identity.logo', 'identity.favicon', 'identity.ogImage', 'product']);

        // home_key = 1 mirrors is_home and hits the unique (tenant_id, home_key) index.
        return $slug === '' ? $query->where('home_key', 1)->first() : $query->where('slug', $slug)->first();
    }

    /** @return array<string, mixed> */
    public function payload(LandingPage $page, string $primaryHost): array
    {
        $content = $page->published_content ?? ['version' => 1, 'sections' => []];
        $themeKey = (string) ($content['theme_key'] ?? $page->theme_key);
        unset($content['theme_key']);

        $identity = $page->identity !== null && ! $page->identity->trashed() ? $page->identity : null;
        $product = $this->data->product($page->product);

        return [
            'page' => [
                'id' => $page->id,
                'slug' => $page->slug,
                'title' => $page->title,
                'is_home' => $page->is_home,
                'theme_key' => $themeKey,
                'published_at' => $page->published_at?->toIso8601ZuluString(),
            ],
            'theme_key' => $themeKey,
            'content' => $content,
            'identity' => $identity === null ? null : $this->data->identity($identity),
            'product' => $product,
            'offers' => $this->data->offers($page->product, now()),
            'media' => (object) $this->data->media($content),
            'seo' => $this->seo($page, $identity, $primaryHost),
            'tracking' => $this->tracking($page, $identity),
        ];
    }

    /** @return array<string, mixed> */
    public function seo(LandingPage $page, ?Identity $identity, string $primaryHost): array
    {
        $override = is_array($page->seo_override) ? $page->seo_override : [];
        $product = $page->product !== null && ! $page->product->trashed() ? $page->product : null;

        $title = $this->firstText($override['title'] ?? null, $identity?->seo_title, $product?->name, $page->title);
        $suffix = trim((string) $identity?->seo_title_suffix);
        if ($suffix !== '' && ! str_ends_with($title, $suffix)) {
            $title .= ' '.$suffix;
        }

        $description = $this->firstText(
            $override['description'] ?? null,
            $identity?->seo_description,
            PlainText::fromMarkdown($product?->description),
        );

        $og = null;
        if (isset($override['og_media_id']) && is_int($override['og_media_id'])) {
            $og = Media::query()->find($override['og_media_id']);
        }
        $og ??= $identity?->ogImage;
        $og ??= $product?->media()->first();

        return [
            'title' => $title,
            'description' => $description,
            'og_image' => $og === null ? null : [
                'url' => $og->urls()['large'] ?? $og->urls()['medium'] ?? null,
                'width' => $og->width,
                'height' => $og->height,
                'alt' => $og->alt,
            ],
            'canonical' => self::url($primaryHost, $page->is_home ? '' : $page->slug),
            'noindex' => ($override['noindex'] ?? false) === true,
            'site_name' => $identity?->brand_name,
        ];
    }

    /**
     * Page override on top of the identity: a non-empty override value wins.
     *
     * @return array<string, string|null>
     */
    public function tracking(LandingPage $page, ?Identity $identity): array
    {
        $base = $identity?->resolvedTracking() ?? array_fill_keys(Identity::TRACKING_KEYS, null);
        $override = is_array($page->tracking_override) ? $page->tracking_override : [];

        foreach (Identity::TRACKING_KEYS as $key) {
            $value = $override[$key] ?? null;
            if (is_string($value) && $value !== '') {
                $base[$key] = $value;
            }
        }

        // Defence in depth: only ids in the strict formats reach the page.
        foreach (TrackingIds::PATTERNS as $key => $pattern) {
            if ($base[$key] !== null && preg_match($pattern, $base[$key]) !== 1) {
                $base[$key] = null;
            }
        }
        $base['conversion_event'] = in_array($base['conversion_event'], TrackingIds::CONVERSION_EVENTS, true) ? $base['conversion_event'] : 'Lead';

        return $base;
    }

    /** Public URL of a page on a host (scheme/port configurable for local development). */
    public static function url(string $host, string $slug = ''): string
    {
        $scheme = (string) config('landing.public_scheme', 'https');
        $port = config('landing.public_port');
        $authority = $host.($port !== null && $port !== '' ? ':'.$port : '');

        return $scheme.'://'.$authority.'/'.($slug === '' ? '' : rawurlencode($slug));
    }

    private function firstText(?string ...$values): string
    {
        foreach ($values as $value) {
            if (is_string($value) && trim($value) !== '') {
                return trim($value);
            }
        }

        return '';
    }
}
