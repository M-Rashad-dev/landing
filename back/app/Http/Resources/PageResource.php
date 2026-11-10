<?php

declare(strict_types=1);

namespace App\Http\Resources;

use App\Models\LandingPage;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** Page list item (no content). @mixin LandingPage */
class PageResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'title' => $this->title,
            'slug' => $this->slug,
            'status' => $this->status->value,
            'locked_by_plan' => (bool) $this->locked_by_plan,
            'theme_key' => $this->theme_key,
            'identity_id' => $this->identity_id,
            'product_id' => $this->product_id,
            'identity' => $this->whenLoaded('identity', fn () => $this->identity ? ['id' => $this->identity->id, 'name' => $this->identity->name] : null),
            'product' => $this->whenLoaded('product', fn () => $this->product ? [
                'id' => $this->product->id,
                'name' => $this->product->name,
                'is_active' => $this->product->is_active && ! $this->product->trashed(),
            ] : null),
            'is_home' => $this->is_home,
            'has_unpublished_changes' => $this->hasUnpublishedChanges(),
            'published_at' => $this->published_at?->toIso8601ZuluString(),
            'created_at' => $this->created_at?->toIso8601ZuluString(),
            'updated_at' => $this->updated_at?->toIso8601ZuluString(),
        ];
    }
}
