<?php

declare(strict_types=1);

namespace App\Http\Resources;

use App\Models\Identity;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin Identity */
final class IdentityResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'is_default' => $this->is_default,
            'brand_name' => $this->brand_name,
            'logo_media_id' => $this->logo_media_id,
            'favicon_media_id' => $this->favicon_media_id,
            'og_image_media_id' => $this->og_image_media_id,
            'logo' => $this->whenLoaded('logo', fn () => $this->logo ? MediaResource::make($this->logo)->resolve($request) : null),
            'favicon' => $this->whenLoaded('favicon', fn () => $this->favicon ? MediaResource::make($this->favicon)->resolve($request) : null),
            'og_image' => $this->whenLoaded('ogImage', fn () => $this->ogImage ? MediaResource::make($this->ogImage)->resolve($request) : null),
            'colors' => $this->resolvedColors(),
            'font_heading' => $this->font_heading,
            'font_body' => $this->font_body,
            'button_radius' => $this->button_radius,
            'seo_title' => $this->seo_title,
            'seo_title_suffix' => $this->seo_title_suffix,
            'seo_description' => $this->seo_description,
            'contact' => $this->resolvedContact(),
            'socials' => $this->resolvedSocials(),
            'tracking' => $this->resolvedTracking(),
            'created_at' => $this->created_at?->toIso8601ZuluString(),
            'updated_at' => $this->updated_at?->toIso8601ZuluString(),
        ];
    }
}
