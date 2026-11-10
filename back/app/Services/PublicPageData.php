<?php

declare(strict_types=1);

namespace App\Services;

use App\Enums\OfferType;
use App\Http\Resources\PublicProductResource;
use App\Models\Identity;
use App\Models\Media;
use App\Models\Offer;
use App\Models\Product;
use App\Support\ContentMedia;
use App\Support\Money;
use Carbon\CarbonInterface;

/**
 * Visitor-facing shapes shared by the public API and the Builder preview,
 * so themes always receive the same data. No internal fields.
 */
final class PublicPageData
{
    /** @return array<string, mixed> */
    public function identity(Identity $identity): array
    {
        $identity->loadMissing(['logo', 'favicon', 'ogImage']);

        return [
            'brand_name' => $identity->brand_name,
            'colors' => $identity->resolvedColors(),
            'font_heading' => $identity->font_heading,
            'font_body' => $identity->font_body,
            'button_radius' => $identity->button_radius,
            'logo' => $this->image($identity->logo),
            'favicon' => $identity->favicon === null ? null : [
                'icon32' => isset($identity->favicon->variants['icon32']) ? Media::url($identity->favicon->variants['icon32']) : $identity->favicon->urls()['thumb'],
                'icon180' => isset($identity->favicon->variants['icon180']) ? Media::url($identity->favicon->variants['icon180']) : $identity->favicon->urls()['thumb'],
            ],
            'og_image' => $this->image($identity->ogImage),
            'seo_title' => $identity->seo_title,
            'seo_title_suffix' => $identity->seo_title_suffix,
            'seo_description' => $identity->seo_description,
            'contact' => $identity->resolvedContact(),
            'socials' => $identity->resolvedSocials(),
        ];
    }

    /** @return array<string, mixed>|null */
    public function product(?Product $product): ?array
    {
        if ($product === null || $product->trashed()) {
            return null;
        }

        $product->loadMissing(['options.values', 'media', 'variants']);

        return PublicProductResource::make($product)->resolve(request());
    }

    /**
     * Offers of the product that are active now or scheduled to start later.
     *
     * @return list<array<string, mixed>>
     */
    public function offers(?Product $product, CarbonInterface $now): array
    {
        if ($product === null || $product->trashed()) {
            return [];
        }

        return Offer::query()
            ->servable()
            ->whereHas('products', fn ($q) => $q->where('products.id', $product->id))
            ->where(fn ($q) => $q->where(fn ($active) => $active->activeAt($now))->orWhere(fn ($soon) => $soon->upcomingAt($now)))
            ->with('giftProduct')
            ->orderByDesc('priority')
            ->orderBy('id')
            ->get()
            ->map(fn (Offer $offer) => $this->offer($offer, $now))
            ->values()
            ->all();
    }

    /** @return array<string, mixed> */
    public function offer(Offer $offer, CarbonInterface $now): array
    {
        return [
            'id' => $offer->id,
            'name' => $offer->name,
            'type' => $offer->type->value,
            'value' => match ($offer->type) {
                OfferType::Percentage => intdiv($offer->valueCents(), 100),
                OfferType::Fixed => Money::toFloat($offer->valueCents()),
                default => null,
            },
            'min_quantity' => $offer->min_quantity,
            'free_quantity' => $offer->free_quantity,
            'required_quantity' => $offer->requiredQuantity(),
            'gift' => $offer->type === OfferType::Gift && $offer->giftProduct && $offer->giftProduct->is_active && ! $offer->giftProduct->trashed()
                ? ['id' => $offer->giftProduct->id, 'name' => $offer->giftProduct->name, 'price' => Money::toFloat($offer->giftProduct->priceCents())]
                : null,
            'bundle_quantity' => $offer->bundle_quantity,
            'bundle_price' => $offer->bundle_price === null ? null : Money::toFloat($offer->bundlePriceCents()),
            'starts_at' => $offer->starts_at?->toIso8601ZuluString(),
            'ends_at' => $offer->ends_at?->toIso8601ZuluString(),
            'status' => $offer->statusAt($now)->value,
            'badge_text' => $offer->badge_text,
            'priority' => $offer->priority,
        ];
    }

    /**
     * Every image referenced by the content, keyed by id (themes resolve *_media_id props here).
     *
     * @param  array<mixed>|null  $content
     * @return array<int, array<string, mixed>>
     */
    public function media(?array $content): array
    {
        $ids = ContentMedia::extract($content);

        if ($ids === []) {
            return [];
        }

        $map = [];
        foreach (Media::query()->whereIn('id', $ids)->get() as $media) {
            $map[$media->id] = $this->image($media);
        }

        return $map;
    }

    /** @return array<string, mixed>|null */
    public function image(?Media $media): ?array
    {
        return $media === null ? null : [
            'id' => $media->id,
            'alt' => $media->alt,
            'width' => $media->width,
            'height' => $media->height,
            'urls' => $media->urls(),
        ];
    }
}
