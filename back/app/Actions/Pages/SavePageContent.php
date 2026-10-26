<?php

declare(strict_types=1);

namespace App\Actions\Pages;

use App\Exceptions\ApiException;
use App\Http\Resources\PageDetailResource;
use App\Models\LandingPage;
use App\Services\PageContentSanitizer;
use Illuminate\Support\Facades\DB;

/** Saves the Builder draft with optimistic locking on `version`. */
final class SavePageContent
{
    public function __construct(
        private readonly PageContentSanitizer $sanitizer,
        private readonly SyncPageMedia $syncMedia,
    ) {}

    public function handle(LandingPage $page, int $version, mixed $content, ?string $themeKey): LandingPage
    {
        $clean = $this->sanitizer->sanitize($content)['content'];

        return DB::transaction(function () use ($page, $version, $clean, $themeKey): LandingPage {
            /** @var LandingPage $locked */
            $locked = LandingPage::query()->lockForUpdate()->findOrFail($page->id);

            if ($locked->version !== $version) {
                throw ApiException::conflict('version_conflict', __('pages.version_conflict'), [
                    'current' => PageDetailResource::make($locked->load(['identity', 'product']))->resolve(request()),
                ]);
            }

            // theme_key is the draft theme; the live page keeps the theme stored in
            // published_content until the next publish (no surprise changes from the Builder).
            $locked->forceFill([
                'draft_content' => $clean,
                'version' => $locked->version + 1,
                'theme_key' => $themeKey ?? $locked->theme_key,
            ])->save();

            $this->syncMedia->handle($locked);

            return $locked;
        });
    }
}
