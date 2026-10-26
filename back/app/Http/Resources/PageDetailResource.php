<?php

declare(strict_types=1);

namespace App\Http\Resources;

use Illuminate\Http\Request;

/** Page with draft content and version (for the Builder and settings). */
final class PageDetailResource extends PageResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return array_merge(parent::toArray($request), [
            'draft_content' => $this->draft_content,
            'version' => $this->version,
            'published_theme_key' => $this->published_content['theme_key'] ?? null,
            'seo_override' => $this->seo_override,
            'tracking_override' => $this->tracking_override,
        ]);
    }
}
