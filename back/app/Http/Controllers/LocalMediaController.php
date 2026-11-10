<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

/**
 * Development stand-in for Caddy's /media/* file server. Never registered in production.
 */
final class LocalMediaController extends Controller
{
    public function __invoke(string $path): BinaryFileResponse
    {
        abort_if(
            str_contains($path, '..') || (preg_match('#^tenants/\d+/\d{4}/\d{2}/[a-z0-9]+-(thumb|medium|large|icon32|icon180)\.(webp|png)$#', $path) !== 1
                && preg_match('#^platform/themes/[a-z0-9_-]{1,40}/[a-z0-9]+-(medium|large)\.webp$#', $path) !== 1),
            404,
        );

        $disk = Storage::disk('public');
        abort_unless($disk->exists($path), 404);

        return response()->file($disk->path($path), [
            'Cache-Control' => 'public, max-age=2592000, immutable',
            'X-Content-Type-Options' => 'nosniff',
        ]);
    }
}
