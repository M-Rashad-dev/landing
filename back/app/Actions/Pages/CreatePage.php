<?php

declare(strict_types=1);

namespace App\Actions\Pages;

use App\Billing\Entitlements;
use App\Enums\PageStatus;
use App\Enums\PlanLimit;
use App\Models\Identity;
use App\Models\LandingPage;
use App\Models\Product;
use App\Themes\LandingThemes;
use Illuminate\Support\Facades\DB;

final class CreatePage
{
    public function __construct(
        private readonly LandingThemes $themes,
        private readonly SyncPageMedia $syncMedia,
    ) {}

    /** @param array{title: string, slug: string, theme_key: string, identity_id?: int|null, product_id?: int|null, content?: mixed} $data */
    public function handle(array $data, ?int $userId): LandingPage
    {
        app(Entitlements::class)->ensureCanAdd(PlanLimit::LandingPages);

        // No content sent: the theme's starter sections (with the product name in the first one).
        $product = isset($data['product_id']) ? Product::query()->find($data['product_id']) : null;
        $content = $this->themes->clean(
            $data['theme_key'],
            isset($data['content']) && $data['content'] !== null ? $data['content'] : $this->themes->starter($data['theme_key'], $product),
        );

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
