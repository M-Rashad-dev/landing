<?php

declare(strict_types=1);

namespace App\Http\Requests\Dashboard;

use App\Http\Requests\ApiRequest;
use App\Models\LandingPage;
use App\Rules\PageSlug;
use App\Rules\TenantExists;
use App\Rules\TenantUnique;
use App\Support\TrackingIds;
use Illuminate\Validation\Rule;

/**
 * POST /pages (create) and PUT /pages/{id} (settings: title, slug, identity, product, SEO, tracking).
 */
final class PageRequest extends ApiRequest
{
    protected function prepareForValidation(): void
    {
        $merge = [];

        if (is_string($this->input('title'))) {
            $merge['title'] = trim(strip_tags($this->input('title')));
        }

        if (is_string($this->input('slug'))) {
            $merge['slug'] = mb_strtolower(trim($this->input('slug')));
        }

        $seo = $this->input('seo_override');
        if (is_array($seo)) {
            foreach (['title', 'description'] as $key) {
                if (isset($seo[$key]) && is_string($seo[$key])) {
                    $value = trim(strip_tags($seo[$key]));
                    $seo[$key] = $value === '' ? null : $value;
                }
            }
            $merge['seo_override'] = $seo;
        }

        $tracking = $this->input('tracking_override');
        if (is_array($tracking)) {
            foreach ($tracking as $key => $value) {
                $tracking[$key] = TrackingIds::normalize((string) $key, $value);
            }
            $merge['tracking_override'] = $tracking;
        }

        $this->merge($merge);
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        /** @var LandingPage|null $page */
        $page = $this->route('page');
        $creating = $page === null;

        return array_merge([
            'title' => ['required', 'string', 'min:1', 'max:120'],
            'slug' => ['required', 'string', new PageSlug, TenantUnique::table('landing_pages', 'slug')->ignore($page?->id)->ignoreTrashed()],
            'theme_key' => $creating
                ? ['required', 'string', Rule::exists('themes', 'key')->where('is_active', true)]
                : ['prohibited'],
            'identity_id' => [$creating ? 'nullable' : 'required', 'integer', TenantExists::table('identities')->ignoreTrashed()],
            'product_id' => ['nullable', 'integer', TenantExists::table('products')->ignoreTrashed()],
            'content' => $creating ? ['nullable', 'array'] : ['prohibited'],

            'seo_override' => ['sometimes', 'nullable', 'array'],
            'seo_override.title' => ['nullable', 'string', 'max:70'],
            'seo_override.description' => ['nullable', 'string', 'max:170'],
            'seo_override.og_media_id' => ['nullable', 'integer', TenantExists::table('media')],
            'seo_override.noindex' => ['nullable', 'boolean'],
        ], TrackingIds::rules('tracking_override'));
    }

    /** @return array<string, mixed>|null */
    public function seoOverride(): ?array
    {
        $seo = $this->validated('seo_override');
        if (! is_array($seo)) {
            return null;
        }

        $clean = [
            'title' => $seo['title'] ?? null,
            'description' => $seo['description'] ?? null,
            'og_media_id' => isset($seo['og_media_id']) ? (int) $seo['og_media_id'] : null,
            'noindex' => (bool) ($seo['noindex'] ?? false),
        ];

        return array_filter($clean, fn ($v) => $v !== null && $v !== false) === [] ? null : $clean;
    }

    /** Only keys that are set win over the identity. @return array<string, string>|null */
    public function trackingOverride(): ?array
    {
        $tracking = $this->validated('tracking_override');
        if (! is_array($tracking)) {
            return null;
        }

        $clean = [];
        foreach (array_merge(array_keys(TrackingIds::PATTERNS), ['conversion_event']) as $key) {
            if (isset($tracking[$key]) && is_string($tracking[$key]) && $tracking[$key] !== '') {
                $clean[$key] = $tracking[$key];
            }
        }

        return $clean === [] ? null : $clean;
    }

    /** @return array<string, string> */
    public function attributes(): array
    {
        return array_merge(parent::attributes(), [
            'title' => 'اسم الصفحة',
            'slug' => 'رابط الصفحة',
            'theme_key' => 'الثيم',
            'identity_id' => 'الهوية',
            'product_id' => 'المنتج',
            'seo_override.title' => 'عنوان SEO',
            'seo_override.description' => 'وصف SEO',
            'seo_override.og_media_id' => 'صورة المشاركة',
        ]);
    }
}
