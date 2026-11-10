<?php

declare(strict_types=1);

namespace App\Billing\Payments;

use App\Exceptions\ApiException;
use finfo;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Intervention\Image\ImageManager;
use Symfony\Component\HttpFoundation\StreamedResponse;
use Throwable;

/**
 * Transfer receipts: checked as real images, re-encoded (metadata stripped, any hidden
 * payload dropped) and kept on the private disk. Served only through authorized endpoints.
 */
final class ReceiptStore
{
    private const DISK = 'local';

    private const MAX_BYTES = 5 * 1024 * 1024;

    private const MAX_DIMENSION = 8000;

    private const ALLOWED_MIMES = ['image/jpeg', 'image/png', 'image/webp'];

    /** @return string the stored path */
    public function store(UploadedFile $file, int $tenantId): string
    {
        $path = $file->getRealPath();
        if ($path === false || ! is_file($path) || filesize($path) <= 0 || filesize($path) > self::MAX_BYTES) {
            throw $this->invalid(__('payments.receipt_too_large', ['max' => self::MAX_BYTES / 1048576]));
        }

        $mime = (string) (new finfo(FILEINFO_MIME_TYPE))->file($path);
        $size = @getimagesize($path);
        if (! in_array($mime, self::ALLOWED_MIMES, true) || $size === false || $size[0] > self::MAX_DIMENSION || $size[1] > self::MAX_DIMENSION) {
            throw $this->invalid(__('payments.receipt_invalid'));
        }

        try {
            $image = ImageManager::gd(autoOrientation: true, decodeAnimation: false, strip: true)->read($path);
            $encoded = $image->scaleDown(width: 1600)->toWebp(quality: 85)->toString();
        } catch (Throwable $e) {
            report($e);

            throw $this->invalid(__('payments.receipt_invalid'));
        }

        $target = sprintf('receipts/%d/%s/%s.webp', $tenantId, now()->format('Y/m'), Str::lower((string) Str::ulid()));
        Storage::disk(self::DISK)->put($target, $encoded);

        return $target;
    }

    public function response(?string $path): StreamedResponse
    {
        if ($path === null || str_contains($path, '..') || ! str_starts_with($path, 'receipts/') || ! Storage::disk(self::DISK)->exists($path)) {
            abort(404);
        }

        return Storage::disk(self::DISK)->response($path, null, [
            'Content-Type' => 'image/webp',
            'Cache-Control' => 'private, no-store',
            'X-Content-Type-Options' => 'nosniff',
        ]);
    }

    public function delete(?string $path): void
    {
        if ($path !== null && ! str_contains($path, '..')) {
            Storage::disk(self::DISK)->delete($path);
        }
    }

    private function invalid(string $message): ApiException
    {
        return new ApiException(422, 'validation_failed', $message, ['receipt' => [$message]]);
    }
}
