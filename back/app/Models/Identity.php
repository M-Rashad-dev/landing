<?php

declare(strict_types=1);

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Database\Factories\IdentityFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * @property int $id
 * @property int $tenant_id
 * @property string $name
 * @property bool $is_default
 * @property string $brand_name
 * @property int|null $logo_media_id
 * @property int|null $favicon_media_id
 * @property int|null $og_image_media_id
 * @property array<string, string> $colors
 * @property string $font_heading
 * @property string $font_body
 * @property string $button_radius
 * @property array<string, string|null>|null $contact
 * @property array<string, string|null>|null $socials
 * @property array<string, string|null>|null $tracking
 */
class Identity extends Model
{
    /** @use HasFactory<IdentityFactory> */
    use BelongsToTenant, HasFactory, SoftDeletes;

    public const COLOR_KEYS = ['primary', 'primary_foreground', 'secondary', 'accent', 'background', 'foreground', 'muted', 'border'];

    public const CONTACT_KEYS = ['phone', 'whatsapp', 'email', 'address'];

    public const SOCIAL_KEYS = ['facebook', 'instagram', 'tiktok', 'youtube', 'x', 'snapchat'];

    public const TRACKING_KEYS = [
        'meta_pixel_id', 'tiktok_pixel_id', 'ga4_id', 'gtm_id', 'snapchat_pixel_id',
        'google_site_verification', 'facebook_domain_verification', 'conversion_event',
    ];

    protected $fillable = [
        'name', 'is_default', 'brand_name', 'logo_media_id', 'favicon_media_id', 'og_image_media_id',
        'colors', 'font_heading', 'font_body', 'button_radius', 'seo_title', 'seo_title_suffix',
        'seo_description', 'contact', 'socials', 'tracking',
    ];

    protected function casts(): array
    {
        return [
            'is_default' => 'boolean',
            'colors' => 'array',
            'contact' => 'array',
            'socials' => 'array',
            'tracking' => 'array',
        ];
    }

    /** @return BelongsTo<Media, $this> */
    public function logo(): BelongsTo
    {
        return $this->belongsTo(Media::class, 'logo_media_id');
    }

    /** @return BelongsTo<Media, $this> */
    public function favicon(): BelongsTo
    {
        return $this->belongsTo(Media::class, 'favicon_media_id');
    }

    /** @return BelongsTo<Media, $this> */
    public function ogImage(): BelongsTo
    {
        return $this->belongsTo(Media::class, 'og_image_media_id');
    }

    /**
     * Colors with safe defaults for any missing key.
     *
     * @return array<string, string>
     */
    public function resolvedColors(): array
    {
        /** @var array<string, string> $defaults */
        $defaults = config('landing.default_colors');
        $colors = is_array($this->colors) ? $this->colors : [];

        $resolved = [];
        foreach (self::COLOR_KEYS as $key) {
            $value = $colors[$key] ?? null;
            $resolved[$key] = is_string($value) && preg_match('/^#[0-9A-Fa-f]{6}$/', $value) === 1 ? strtoupper($value) : $defaults[$key];
        }

        return $resolved;
    }

    /** @return array<string, string|null> */
    public function resolvedContact(): array
    {
        return $this->onlyKeys($this->contact, self::CONTACT_KEYS);
    }

    /** @return array<string, string|null> */
    public function resolvedSocials(): array
    {
        return $this->onlyKeys($this->socials, self::SOCIAL_KEYS);
    }

    /** @return array<string, string|null> */
    public function resolvedTracking(): array
    {
        $tracking = $this->onlyKeys($this->tracking, self::TRACKING_KEYS);
        $tracking['conversion_event'] = in_array($tracking['conversion_event'], ['Lead', 'Purchase'], true) ? $tracking['conversion_event'] : 'Lead';

        return $tracking;
    }

    /**
     * @param  array<string, mixed>|null  $values
     * @param  list<string>  $keys
     * @return array<string, string|null>
     */
    private function onlyKeys(?array $values, array $keys): array
    {
        $result = [];
        foreach ($keys as $key) {
            $value = $values[$key] ?? null;
            $result[$key] = is_string($value) && $value !== '' ? $value : null;
        }

        return $result;
    }
}
