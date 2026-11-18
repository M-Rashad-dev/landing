<?php

declare(strict_types=1);

namespace App\Ai\Designer;

use App\Actions\Media\UploadMedia;
use App\Ai\AiImage;
use App\Exceptions\ApiException;
use App\Models\Media;
use App\Models\Tenant;
use App\Tenancy\Tenancy;
use Illuminate\Http\UploadedFile;
use RuntimeException;

final class AiImages
{
    public function __construct(
        private readonly UploadMedia $upload,
    ) {}

    public function store(Tenant $tenant, AiImage $image, string $name, ?string $alt = null): Media
    {
        $tmpPath = tempnam(sys_get_temp_dir(), 'ai_img_');

        if ($tmpPath === false || file_put_contents($tmpPath, $image->bytes) === false) {
            if (is_string($tmpPath) && is_file($tmpPath)) {
                @unlink($tmpPath);
            }

            throw new RuntimeException('Could not write temporary AI image file.');
        }

        $safeBase = trim((string) preg_replace('/[^\p{L}\p{N}_\- ]+/u', '', $name));
        if ($safeBase === '') {
            $safeBase = 'ai-image';
        }
        $safeBase = mb_substr($safeBase, 0, 80);
        $fileName = "{$safeBase}.{$image->extension()}";

        try {
            $file = new UploadedFile($tmpPath, $fileName, $image->mime, null, true);

            return Tenancy::runAs((int) $tenant->id, function () use ($file, $alt): Media {
                try {
                    $uploaded = $this->upload->handle([$file], 'general');
                } catch (ApiException $e) {
                    if (in_array($e->errorCode, ['plan_limit_reached', 'limit_reached'], true)) {
                        throw new ApiException(422, 'storage_full', __('ai.designer.storage_full'));
                    }

                    throw $e;
                }

                $media = $uploaded[0];

                if ($alt !== null && trim($alt) !== '') {
                    $media->forceFill(['alt' => mb_substr(trim($alt), 0, 190)])->save();
                }

                return $media;
            });
        } finally {
            if (is_file($tmpPath)) {
                @unlink($tmpPath);
            }
        }
    }
}
