<?php

declare(strict_types=1);

namespace App\Billing\Themes;

use App\Exceptions\ApiException;
use finfo;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Intervention\Image\ImageManager;
use Throwable;

/** Theme store screenshots: decoded, re-encoded to WebP (medium + large), public disk under platform/themes/{key}. */
final class ThemeImageStore
{
    private const DISK = 'public';

    private const MAX_BYTES = 5 * 1024 * 1024;

    private const WIDTHS = ['medium' => 800, 'large' => 1600];

    /** @return array{variants: array<string, string>, width: int, height: int} */
    public function store(UploadedFile $file, string $themeKey): array
    {
        $path = $file->getRealPath();
        $mime = $path === false ? '' : (string) (new finfo(FILEINFO_MIME_TYPE))->file($path);
        if ($path === false || filesize($path) > self::MAX_BYTES || ! in_array($mime, ['image/jpeg', 'image/png', 'image/webp'], true) || @getimagesize($path) === false) {
            throw new ApiException(422, 'validation_failed', __('themes.image_invalid'), ['image' => [__('themes.image_invalid')]]);
        }

        $disk = Storage::disk(self::DISK);
        $base = sprintf('platform/themes/%s/%s', $themeKey, Str::lower((string) Str::ulid()));
        $written = [];

        try {
            $source = ImageManager::gd(autoOrientation: true, decodeAnimation: false, strip: true)->read($path);
            $variants = [];
            foreach (self::WIDTHS as $variant => $width) {
                $target = "{$base}-{$variant}.webp";
                $disk->put($target, (clone $source)->scaleDown(width: $width)->toWebp(quality: 82)->toString());
                $written[] = $target;
                $variants[$variant] = $target;
            }

            return ['variants' => $variants, 'width' => $source->width(), 'height' => $source->height()];
        } catch (Throwable $e) {
            foreach ($written as $target) {
                $disk->delete($target);
            }
            report($e);

            throw new ApiException(422, 'validation_failed', __('themes.image_invalid'), ['image' => [__('themes.image_invalid')]]);
        }
    }

    /** @param array<string, string> $variants */
    public function delete(array $variants): void
    {
        foreach ($variants as $path) {
            if (str_starts_with($path, 'platform/themes/') && ! str_contains($path, '..')) {
                Storage::disk(self::DISK)->delete($path);
            }
        }
    }
}
