<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Concerns\RespondsWithJson;
use App\Http\Controllers\Controller;
use App\Models\PlatformPage;
use Illuminate\Http\JsonResponse;

/** The platform's own pages for the platform domain (no sign-in): the published list and one page. */
final class PlatformPageController extends Controller
{
    use RespondsWithJson;

    public function index(): JsonResponse
    {
        $pages = PlatformPage::query()->published()->orderBy('sort_order')->get(['slug', 'title']);

        return $this->ok($pages->map(fn (PlatformPage $p) => ['slug' => $p->slug, 'title' => $p->title])->all())
            ->header('Cache-Control', 'public, max-age=60');
    }

    public function show(string $slug): JsonResponse
    {
        $page = PlatformPage::query()->published()->where('slug', $slug)->firstOrFail();

        return $this->ok([
            'slug' => $page->slug,
            'title' => $page->title,
            'summary' => $page->summary,
            'body' => $page->body,
            'updated_at' => $page->updated_at?->toIso8601ZuluString(),
        ])->header('Cache-Control', 'public, max-age=60');
    }
}
