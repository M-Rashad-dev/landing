<?php

declare(strict_types=1);

namespace App\Jobs;

use App\Services\FrontendRevalidator;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Log;
use Throwable;

/** Purges Next's cached data for some platform-wide tags (e.g. the platform pages after an admin edit). */
final class RevalidateFrontendTags implements ShouldQueue
{
    use Queueable;

    public int $tries = 3;

    /** @param list<string> $tags */
    public function __construct(public readonly array $tags) {}

    /** @return list<int> */
    public function backoff(): array
    {
        return [5, 20, 60];
    }

    public function handle(FrontendRevalidator $revalidator): void
    {
        try {
            $revalidator->revalidateTags($this->tags);
        } catch (Throwable $e) {
            Log::warning('revalidate failed, will retry', ['tags' => $this->tags, 'error' => $e->getMessage()]);

            throw $e;
        }
    }

    public function failed(?Throwable $e): void
    {
        Log::warning('revalidate gave up; pages refresh on their own cache time', ['tags' => $this->tags, 'error' => $e?->getMessage()]);
    }
}
