<?php

declare(strict_types=1);

namespace App\Http\Requests\Dashboard;

use App\Http\Requests\ApiRequest;
use App\Models\Identity;
use App\Rules\EgyptPhone;
use App\Rules\SocialUrl;
use App\Rules\TenantExists;
use App\Services\PhoneNormalizer;
use App\Support\TrackingIds;

/** Create and full update of an identity. */
final class IdentityRequest extends ApiRequest
{
    protected function prepareForValidation(): void
    {
        $merge = [];

        foreach (['name', 'brand_name', 'seo_title', 'seo_title_suffix', 'seo_description'] as $key) {
            if (is_string($this->input($key))) {
                $value = trim(strip_tags($this->input($key)));
                $merge[$key] = $value === '' ? null : $value;
            }
        }

        $colors = $this->input('colors');
        if (is_array($colors)) {
            $merge['colors'] = array_map(fn ($c) => is_string($c) ? strtoupper(trim($c)) : $c, $colors);
        }

        $contact = $this->input('contact');
        if (is_array($contact)) {
            $phones = app(PhoneNormalizer::class);
            foreach (['phone', 'whatsapp'] as $key) {
                if (isset($contact[$key]) && is_string($contact[$key])) {
                    $contact[$key] = trim($contact[$key]) === '' ? null : ($phones->normalize($contact[$key]) ?? $contact[$key]);
                }
            }
            foreach (['email', 'address'] as $key) {
                if (isset($contact[$key]) && is_string($contact[$key])) {
                    $value = trim(strip_tags($contact[$key]));
                    $contact[$key] = $value === '' ? null : ($key === 'email' ? mb_strtolower($value) : $value);
                }
            }
            $merge['contact'] = $contact;
        }

        $socials = $this->input('socials');
        if (is_array($socials)) {
            $merge['socials'] = array_map(fn ($v) => is_string($v) && trim($v) !== '' ? trim($v) : null, $socials);
        }

        $tracking = $this->input('tracking');
        if (is_array($tracking)) {
            foreach ($tracking as $key => $value) {
                $tracking[$key] = TrackingIds::normalize((string) $key, $value);
            }
            $merge['tracking'] = $tracking;
        }

        $this->merge($merge);
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        $hex = 'regex:/^#[0-9A-F]{6}$/';
        $media = fn () => ['nullable', 'integer', TenantExists::table('media')];

        $rules = [
            'name' => ['required', 'string', 'max:60'],
            'brand_name' => ['required', 'string', 'max:60'],
            'logo_media_id' => $media(),
            'favicon_media_id' => $media(),
            'og_image_media_id' => $media(),

            'colors' => ['required', 'array'],
            'colors.primary' => ['required', 'string', $hex],
            'colors.primary_foreground' => ['nullable', 'string', $hex],
            'colors.secondary' => ['required', 'string', $hex],
            'colors.accent' => ['required', 'string', $hex],
            'colors.background' => ['required', 'string', $hex],
            'colors.foreground' => ['required', 'string', $hex],
            'colors.muted' => ['required', 'string', $hex],
            'colors.border' => ['required', 'string', $hex],

            'font_heading' => ['required', 'string', 'in:'.implode(',', config('landing.fonts'))],
            'font_body' => ['required', 'string', 'in:'.implode(',', config('landing.fonts'))],
            'button_radius' => ['required', 'string', 'in:'.implode(',', config('landing.button_radii'))],

            'seo_title' => ['nullable', 'string', 'max:70'],
            'seo_title_suffix' => ['nullable', 'string', 'max:40'],
            'seo_description' => ['nullable', 'string', 'max:170'],

            'contact' => ['nullable', 'array'],
            'contact.phone' => ['nullable', 'string', new EgyptPhone],
            'contact.whatsapp' => ['nullable', 'string', new EgyptPhone],
            'contact.email' => ['nullable', 'string', 'email:filter', 'max:191'],
            'contact.address' => ['nullable', 'string', 'max:300'],

            'socials' => ['nullable', 'array'],
        ];

        foreach (Identity::SOCIAL_KEYS as $network) {
            $rules["socials.{$network}"] = ['nullable', 'string', new SocialUrl($network)];
        }

        return array_merge($rules, TrackingIds::rules('tracking'));
    }

    /**
     * Only known keys are kept (unknown nested keys are dropped).
     *
     * @return array<string, mixed>
     */
    public function identityData(): array
    {
        $data = $this->validated();

        $pick = function (?array $values, array $keys): array {
            $result = [];
            foreach ($keys as $key) {
                $result[$key] = $values[$key] ?? null;
            }

            return $result;
        };

        return [
            'name' => $data['name'],
            'brand_name' => $data['brand_name'],
            'logo_media_id' => $data['logo_media_id'] ?? null,
            'favicon_media_id' => $data['favicon_media_id'] ?? null,
            'og_image_media_id' => $data['og_image_media_id'] ?? null,
            'colors' => array_filter($pick($data['colors'], Identity::COLOR_KEYS), fn ($v) => $v !== null),
            'font_heading' => $data['font_heading'],
            'font_body' => $data['font_body'],
            'button_radius' => $data['button_radius'],
            'seo_title' => $data['seo_title'] ?? null,
            'seo_title_suffix' => $data['seo_title_suffix'] ?? null,
            'seo_description' => $data['seo_description'] ?? null,
            'contact' => $pick($data['contact'] ?? [], Identity::CONTACT_KEYS),
            'socials' => $pick($data['socials'] ?? [], Identity::SOCIAL_KEYS),
            'tracking' => array_merge(
                $pick($data['tracking'] ?? [], Identity::TRACKING_KEYS),
                ['conversion_event' => $data['tracking']['conversion_event'] ?? 'Lead'],
            ),
        ];
    }
}
