<?php

declare(strict_types=1);

namespace App\Actions\Pages;

use App\Enums\PageStatus;
use App\Exceptions\ApiException;
use App\Models\Identity;
use App\Models\LandingPage;
use App\Services\PageContentSanitizer;
use Illuminate\Support\Facades\DB;

final class CreatePage
{
    public function __construct(
        private readonly PageContentSanitizer $sanitizer,
        private readonly SyncPageMedia $syncMedia,
    ) {}

    /** @param array{title: string, slug: string, theme_key: string, identity_id?: int|null, product_id?: int|null, content?: mixed} $data */
    public function handle(array $data, ?int $userId): LandingPage
    {
        $limit = (int) config('landing.limits.pages');
        if (LandingPage::query()->count() >= $limit) {
            throw new ApiException(422, 'limit_reached', __('pages.limit', ['limit' => $limit]));
        }

        $content = isset($data['content']) && $data['content'] !== null
            ? $this->sanitizer->sanitize($data['content'])['content']
            : ['version' => 1, 'sections' => []];

        $identityId = $data['identity_id'] ?? Identity::query()->where('is_default', true)->value('id') ?? Identity::query()->value('id');

        return DB::transaction(function () use ($data, $content, $identityId, $userId): LandingPage {
            $page = LandingPage::create([
                'title' => $data['title'],
                'slug' => $data['slug'],
                'status' => PageStatus::Draft,
                'theme_key' => $data['theme_key'],
                'identity_id' => $identityId,
                'product_id' => $data['product_id'] ?? null,
                'draft_content' => $content,
                'version' => 1,
                'is_home' => false,
                'created_by' => $userId,
            ]);

            $this->syncMedia->handle($page);

            return $page;
        });
    }
}
