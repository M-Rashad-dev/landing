<?php

declare(strict_types=1);

namespace App\Actions\Media;

use App\Exceptions\ApiException;
use App\Models\Media;
use App\Services\MediaProcessor;
use App\Services\MediaUsageFinder;

final class DeleteMedia
{
    public function __construct(
        private readonly MediaUsageFinder $usages,
        private readonly MediaProcessor $processor,
    ) {}

    public function handle(Media $media): void
    {
        $usages = $this->usages->find($media);

        if ($usages !== []) {
            throw ApiException::conflict('media_in_use', __('media.in_use'), [
                'usages' => array_map(fn (array $usage): array => $usage + ['label' => __('media.usage.'.$usage['type'])], $usages),
            ]);
        }

        $paths = $media->allPaths();
        $disk = $media->disk;

        $media->delete();
        $this->processor->deleteFiles($disk, $paths);
    }
}
