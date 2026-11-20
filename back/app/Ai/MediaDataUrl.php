<?php

declare(strict_types=1);

namespace App\Ai;

use App\Models\Media;
use Illuminate\Support\Facades\Storage;

/**
 * A store image as a data URL for the AI (the provider can't reach our files): the medium variant (≤ 1600 px),
 * refused above 5 MB. With the fake driver a missing file becomes a 1×1 PNG so local runs and tests work.
 * Runs under the tenant scope: another store's media id gives null.
 */
final class MediaDataUrl
{
    public const MAX_BYTES = 5_000_000;

    private const FAKE = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

    public static function for(int $mediaId): ?string
    {
        $media = Media::query()->find($mediaId);
        if (! $media instanceof Media) {
            return null;
        }

        $path = $media->variants['medium'] ?? $media->path;
        $disk = Storage::disk($media->disk);
        if ($disk->exists($path)) {
            $bytes = (string) $disk->get($path);
            if ($bytes !== '' && strlen($bytes) <= self::MAX_BYTES) {
                $mime = $media->mime !== '' ? $media->mime : 'image/webp';

                return "data:{$mime};base64,".base64_encode($bytes);
            }
        }

        return config('ai.driver') === 'fake' ? self::FAKE : null;
    }

    /**
     * @param  list<int>  $ids
     * @return list<string>
     */
    public static function many(array $ids): array
    {
        return array_values(array_filter(array_map(fn (int $id) => self::for($id), $ids)));
    }
}
