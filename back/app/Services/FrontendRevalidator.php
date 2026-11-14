<?php

declare(strict_types=1);

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use RuntimeException;

/**
 * Tells Next to drop its cached public data for some hosts
 * (POST {FRONT_INTERNAL_URL}/api/revalidate with the shared secret).
 */
final class FrontendRevalidator
{
    private const MAX_TAGS = 50;

    public function isConfigured(): bool
    {
        return config('landing.front_internal_url') !== '' && config('landing.revalidate_secret') !== '';
    }

    /**
     * @param  list<string>  $hosts
     *
     * @throws RuntimeException when Next answers with an error (so the job retries)
     */
    public function revalidateHosts(array $hosts): void
    {
        $this->revalidateTags(array_values(array_map(fn (string $host): string => 'host:'.mb_strtolower($host), array_filter($hosts))));
    }

    /**
     * @param  list<string>  $tags
     *
     * @throws RuntimeException when Next answers with an error (so the job retries)
     */
    public function revalidateTags(array $tags): void
    {
        $tags = array_values(array_unique(array_filter($tags)));

        if ($tags === []) {
            return;
        }

        if (! $this->isConfigured()) {
            Log::warning('revalidate skipped: FRONT_INTERNAL_URL or REVALIDATE_SECRET is empty', ['tags' => $tags]);

            return;
        }

        foreach (array_chunk($tags, self::MAX_TAGS) as $chunk) {
            $response = Http::timeout(5)
                ->acceptJson()
                ->withHeaders(['X-Revalidate-Secret' => (string) config('landing.revalidate_secret')])
                ->post(config('landing.front_internal_url').'/api/revalidate', ['tags' => $chunk]);

            if ($response->failed()) {
                throw new RuntimeException('Next revalidate failed with HTTP '.$response->status());
            }
        }
    }
}
