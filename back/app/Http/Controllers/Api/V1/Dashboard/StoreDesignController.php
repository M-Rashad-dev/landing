<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Dashboard;

use App\Billing\Entitlements;
use App\Billing\Themes\ThemeCatalog;
use App\Enums\PlanFeature;
use App\Http\Controllers\Concerns\RespondsWithJson;
use App\Http\Controllers\Controller;
use App\Models\StoreDesign;
use App\Models\Tenant;
use App\Models\User;
use App\Store\QuizResults;
use App\Store\StoreSetup;
use App\Themes\Store\StoreDesigner;
use App\Themes\Store\StoreThemes;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * The Builder of the store: the design of the active theme (draft + what its sections show),
 * saving the draft and publishing it. The store is prepared on first open (needs the plan).
 */
final class StoreDesignController extends Controller
{
    use RespondsWithJson;

    public function __construct(
        private readonly StoreSetup $setup,
        private readonly StoreDesigner $designer,
        private readonly ThemeCatalog $catalog,
        private readonly Entitlements $entitlements,
        private readonly StoreThemes $themes,
    ) {}

    public function show(Request $request): JsonResponse
    {
        return $this->ok($this->payload($this->design($request)));
    }

    public function update(Request $request): JsonResponse
    {
        $data = $request->validate(['draft' => ['required', 'array'], 'version' => ['required', 'integer', 'min:1']]);

        return $this->ok($this->payload($this->designer->save($this->design($request), $data['draft'], (int) $data['version'])));
    }

    public function publish(Request $request): JsonResponse
    {
        return $this->ok($this->payload($this->designer->publish($this->design($request))));
    }

    /** «اختبار البشرة»: how many visitors got each result in the last days (the Builder's quiz form). */
    public function quizResults(Request $request, QuizResults $results): JsonResponse
    {
        $days = max(1, min(90, (int) $request->query('days', 30)));

        return $this->ok($results->summary((array) ($this->design($request)->draft['sections'] ?? []), $days));
    }

    private function design(Request $request): StoreDesign
    {
        /** @var User $user */
        $user = $request->user();
        $tenant = $user->tenant ?? abort(403);
        $this->entitlements->ensure(PlanFeature::Store);

        return $this->designer->for($this->setup->current() ?? $this->setup->ensure($tenant));
    }

    /** @return array<string, mixed> */
    private function payload(StoreDesign $design): array
    {
        /** @var Tenant|null $tenant */
        $tenant = Tenant::query()->find($design->tenant_id);

        $theme = $this->themes->for($design->theme_key);

        return [
            'theme' => [
                'key' => $design->theme_key,
                'name' => (string) ($this->catalog->theme($design->theme_key)['name'] ?? $design->theme_key),
                // What the server accepts for this theme: the Builder offers exactly these.
                'section_types' => $theme::SECTION_TYPES,
                'max_sections' => $theme::MAX_SECTIONS,
                'settings_groups' => $theme::SETTINGS_GROUPS,
            ],
            'store_name' => (string) $tenant?->name,
            'draft' => $design->draft,
            'version' => $design->version,
            'published_at' => $design->published_at?->toIso8601ZuluString(),
            'has_unpublished_changes' => $design->hasUnpublishedChanges(),
            'data' => $this->designer->data($design->draft),
        ];
    }
}
