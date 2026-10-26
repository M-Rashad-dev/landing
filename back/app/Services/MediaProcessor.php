<?php

declare(strict_types=1);

namespace App\Services;

use finfo;
use Illuminate\Contracts\Filesystem\Filesystem;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Intervention\Image\ImageManager;
use RuntimeException;
use Throwable;

/**
 * Validates an uploaded image by its real bytes, re-encodes it (dropping EXIF and
 * anything embedded), fixes orientation and writes WebP variants with random names.
 */
final class MediaProcessor
{
    public const ALLOWED_MIMES = ['image/jpeg', 'image/png', 'image/webp'];

    private const MAX_DIMENSION = 6000;

    private const MIN_WIDTH = 16;

    /** @var array<string, int> */
    private const VARIANT_WIDTHS = ['thumb' => 320, 'medium' => 800, 'large' => 1600];

    /** @var array<string, int> */
    private const ICON_SIZES = ['icon32' => 32, 'icon180' => 180];

    public function __construct(private readonly string $disk = 'public') {}

    /**
     * @return array{disk: string, path: string, variants: array<string, string>, original_name: string, mime: string, size_bytes: int, width: int, height: int}
     *
     * @throws MediaRejected
     */
    public function process(UploadedFile $file, int $tenantId, string $purpose = 'general'): array
    {
        $realPath = $file->getRealPath();

        if ($realPath === false || ! is_file($realPath)) {
            throw new MediaRejected(__('media.invalid_file'));
        }

        $maxBytes = (int) config('landing.limits.upload_max_kb') * 1024;
        $size = (int) filesize($realPath);

        if ($size <= 0 || $size > $maxBytes) {
            throw new MediaRejected(__('media.too_large', ['max' => (int) round($maxBytes / 1024 / 1024)]));
        }

        $mime = (string) (new finfo(FILEINFO_MIME_TYPE))->file($realPath);

        if (! in_array($mime, self::ALLOWED_MIMES, true)) {
            throw new MediaRejected(__('media.invalid_type'));
        }

        $dimensions = @getimagesize($realPath);

        if ($dimensions === false) {
            throw new MediaRejected(__('media.invalid_file'));
        }

        [$width, $height] = $dimensions;

        if ($width > self::MAX_DIMENSION || $height > self::MAX_DIMENSION) {
            throw new MediaRejected(__('media.too_big_dimensions', ['max' => self::MAX_DIMENSION]));
        }

        if ($width < self::MIN_WIDTH) {
            throw new MediaRejected(__('media.too_small', ['min' => self::MIN_WIDTH]));
        }

        $written = [];
        $storage = Storage::disk($this->disk);

        try {
            $manager = ImageManager::gd(autoOrientation: true, decodeAnimation: false, strip: true);
            $source = $manager->read($realPath);

            $baseName = sprintf('tenants/%d/%s/%s', $tenantId, now()->format('Y/m'), Str::lower((string) Str::ulid()));
            $variants = [];

            foreach (self::VARIANT_WIDTHS as $variant => $targetWidth) {
                $path = "{$baseName}-{$variant}.webp";
                $encoded = (clone $source)->scaleDown(width: $targetWidth)->toWebp(quality: 82);
                $this->put($storage, $path, $encoded->toString());
                $written[] = $path;
                $variants[$variant] = $path;
            }

            if ($purpose === 'favicon') {
                foreach (self::ICON_SIZES as $variant => $iconSize) {
                    $path = "{$baseName}-{$variant}.png";
                    $encoded = (clone $source)->cover($iconSize, $iconSize)->toPng();
                    $this->put($storage, $path, $encoded->toString());
                    $written[] = $path;
                    $variants[$variant] = $path;
                }
            }

            return [
                'disk' => $this->disk,
                'path' => $variants['large'],
                'variants' => $variants,
                'original_name' => $this->safeOriginalName($file),
                'mime' => 'image/webp',
                'size_bytes' => $this->totalSize($storage, $variants['large']),
                'width' => $source->width(),
                'height' => $source->height(),
            ];
        } catch (Throwable $e) {
            foreach ($written as $path) {
                $storage->delete($path);
            }

            if ($e instanceof MediaRejected) {
                throw $e;
            }

            report($e);

            throw new MediaRejected(__('media.processing_failed'));
        }
    }

    /** @param list<string> $paths */
    public function deleteFiles(string $disk, array $paths): void
    {
        $storage = Storage::disk($disk);

        foreach ($paths as $path) {
            if ($path !== '' && ! str_contains($path, '..')) {
                $storage->delete($path);
            }
        }
    }

    private function put(Filesystem $storage, string $path, string $contents): void
    {
        if (! $storage->put($path, $contents)) {
            throw new RuntimeException("Could not write media file [{$path}].");
        }
    }

    private function totalSize(Filesystem $storage, string $path): int
    {
        return (int) $storage->size($path);
    }

    private function safeOriginalName(UploadedFile $file): string
    {
        $name = (string) preg_replace('/[\x00-\x1F\x7F<>"\\\\\/]+/u', '', $file->getClientOriginalName());
        $name = trim(mb_substr($name, 0, 200));

        return $name === '' ? 'image' : $name;
    }
}
