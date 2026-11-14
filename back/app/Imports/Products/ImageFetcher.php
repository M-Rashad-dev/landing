<?php

declare(strict_types=1);

namespace App\Imports\Products;

use App\Services\Webhooks\OutboundUrl;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Http;
use RuntimeException;
use Throwable;

/**
 * Downloads one product image from a link in the sheet (Shopify CDN, a Woo site…). Only public
 * http(s) addresses on the usual ports, the connection pinned to the address we checked (no
 * requests into our own network), no redirects, a size cap and a short timeout.
 */
final class ImageFetcher
{
    private const TIMEOUT = 20;

    public function __construct(private readonly OutboundUrl $urls) {}

    /** A temporary uploaded file for the media pipeline, or null when the link cannot be used. */
    public function fetch(string $url): ?UploadedFile
    {
        $parts = parse_url($url);
        $scheme = strtolower((string) ($parts['scheme'] ?? ''));
        $host = strtolower((string) ($parts['host'] ?? ''));
        $port = (int) ($parts['port'] ?? ($scheme === 'https' ? 443 : 80));
        if (! in_array($scheme, ['http', 'https'], true) || $host === '' || isset($parts['user']) || ! in_array($port, [80, 443], true)) {
            return null;
        }
        if ($host === 'localhost' || str_ends_with($host, '.localhost') || str_ends_with($host, '.local') || str_ends_with($host, '.internal')) {
            return null;
        }
        $ip = $this->urls->resolve($url);
        if ($ip === null) {
            return null;
        }

        $max = (int) config('landing.limits.upload_max_kb') * 1024;
        $tmp = tempnam(sys_get_temp_dir(), 'img');
        if ($tmp === false) {
            return null;
        }

        try {
            $response = Http::timeout(self::TIMEOUT)
                ->connectTimeout(8)
                ->withoutRedirecting()
                ->withHeaders(['Accept' => 'image/*'])
                // The transfer is cut as soon as it passes the size cap (no huge downloads into memory).
                ->withOptions(['curl' => [CURLOPT_RESOLVE => ["{$host}:{$port}:{$ip}"]], 'progress' => function ($total, $downloaded) use ($max): void {
                    if ($total > $max || $downloaded > $max) {
                        throw new RuntimeException('too large');
                    }
                }])
                ->get($url);
            $body = $response->body();
            if (! $response->successful() || $body === '' || strlen($body) > $max) {
                @unlink($tmp);

                return null;
            }
            file_put_contents($tmp, $body);
        } catch (Throwable) {
            @unlink($tmp);

            return null;
        }

        $name = basename((string) ($parts['path'] ?? 'image')) ?: 'image';

        return new UploadedFile($tmp, mb_substr($name, 0, 100), null, null, true);
    }
}
