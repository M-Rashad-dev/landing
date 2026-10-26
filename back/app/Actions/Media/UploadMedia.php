<?php

declare(strict_types=1);

namespace App\Actions\Media;

use App\Exceptions\ApiException;
use App\Models\Media;
use App\Services\MediaProcessor;
use App\Services\MediaRejected;
use App\Tenancy\Tenancy;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Throwable;

final class UploadMedia
{
    public function __construct(private readonly MediaProcessor $processor) {}

    /**
     * Processes every file; if any fails, nothing is kept and the error is reported on files.{index}.
     *
     * @param  list<UploadedFile>  $files
     * @return list<Media>
     */
    public function handle(array $files, string $purpose): array
    {
        $tenantId = (int) Tenancy::id();
        $limit = (int) config('landing.limits.media');

        if (Media::query()->count() + count($files) > $limit) {
            throw new ApiException(422, 'limit_reached', __('media.limit', ['limit' => $limit]), [
                'files' => [__('media.limit', ['limit' => $limit])],
            ]);
        }

        $processed = [];

        try {
            foreach ($files as $index => $file) {
                try {
                    $processed[] = $this->processor->process($file, $tenantId, $purpose);
                } catch (MediaRejected $e) {
                    throw new ApiException(422, 'validation_failed', $e->getMessage(), ["files.{$index}" => [$e->getMessage()]]);
                }
            }

            return DB::transaction(fn (): array => array_map(
                fn (array $data): Media => Media::create($data),
                $processed,
            ));
        } catch (Throwable $e) {
            foreach ($processed as $data) {
                $this->processor->deleteFiles($data['disk'], array_values($data['variants']));
            }

            throw $e;
        }
    }
}
