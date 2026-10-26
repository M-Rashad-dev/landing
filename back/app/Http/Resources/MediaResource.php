<?php

declare(strict_types=1);

namespace App\Http\Resources;

use App\Models\Media;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin Media */
final class MediaResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->original_name,
            'alt' => $this->alt,
            'width' => $this->width,
            'height' => $this->height,
            'urls' => $this->urls(),
            'size' => $this->size_bytes,
            'created_at' => $this->created_at?->toIso8601ZuluString(),
        ];
    }
}
