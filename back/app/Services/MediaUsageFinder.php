<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\Identity;
use App\Models\Media;

/**
 * Where a media item is referenced (all queries run inside the media's tenant).
 * Each usage: {type, id, name}.
 */
final class MediaUsageFinder
{
    /** @return list<array{type: string, id: int, name: string}> */
    public function find(Media $media): array
    {
        return array_merge(
            $this->identities($media),
        );
    }

    /** @return list<array{type: string, id: int, name: string}> */
    private function identities(Media $media): array
    {
        $usages = [];

        $identities = Identity::query()
            ->where(fn ($q) => $q
                ->where('logo_media_id', $media->id)
                ->orWhere('favicon_media_id', $media->id)
                ->orWhere('og_image_media_id', $media->id))
            ->get(['id', 'name', 'logo_media_id', 'favicon_media_id', 'og_image_media_id']);

        foreach ($identities as $identity) {
            $roles = array_filter([
                $identity->logo_media_id === $media->id ? 'identity_logo' : null,
                $identity->favicon_media_id === $media->id ? 'identity_favicon' : null,
                $identity->og_image_media_id === $media->id ? 'identity_og' : null,
            ]);

            foreach ($roles as $role) {
                $usages[] = ['type' => $role, 'id' => $identity->id, 'name' => $identity->name];
            }
        }

        return $usages;
    }
}
