<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Dashboard;

use App\Billing\Themes\ThemeAccess;
use App\Billing\Themes\ThemeCatalog;
use App\Http\Controllers\Concerns\RespondsWithJson;
use App\Http\Controllers\Controller;
use App\Http\Requests\Dashboard\StoreRequest;
use App\Models\Category;
use App\Models\Product;
use App\Models\Store;
use App\Models\Tenant;
use App\Models\User;
use App\Store\StoreSetup;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** «إعدادات المتجر» and «الثيم والرئيسية»: the store, its state, its theme and the themes the store owns. */
final class StoreController extends Controller
{
    use RespondsWithJson;

    public function __construct(
        private readonly StoreSetup $setup,
        private readonly ThemeCatalog $catalog,
        private readonly ThemeAccess $access,
    ) {}

    public function show(Request $request): JsonResponse
    {
        return $this->ok($this->row($this->tenant($request), $this->setup->current()));
    }

    /** First time: creates the store and the starter design of its theme. */
    public function setup(Request $request): JsonResponse
    {
        $store = $this->setup->ensure($this->tenant($request));

        return $this->ok($this->row($this->tenant($request), $store));
    }

    public function update(StoreRequest $request): JsonResponse
    {
        $tenant = $this->tenant($request);
        $store = $this->setup->current() ?? $this->setup->ensure($tenant);

        return $this->ok($this->row($tenant, $this->setup->update($tenant, $store, $request->cleaned())));
    }

    /** @return array<string, mixed> */
    private function row(Tenant $tenant, ?Store $store): array
    {
        if ($store === null) {
            return ['exists' => false, 'live' => false];
        }
        $design = $store->design();

        return [
            'exists' => true,
            'is_enabled' => $store->is_enabled,
            'live' => $this->setup->isLive($tenant, $store),
            'theme_key' => $store->theme_key,
            'design' => $design === null ? null : [
                'published_at' => $design->published_at?->toIso8601ZuluString(),
                'has_unpublished_changes' => $design->hasUnpublishedChanges(),
                'updated_at' => $design->updated_at?->toIso8601ZuluString(),
            ],
            // «ثيماتي»: the free store themes and the ones the store bought.
            'themes' => array_values(array_map(fn (array $t) => [
                'key' => $t['key'],
                'name' => $t['name'],
                'short_description' => $t['short_description'] ?? null,
                'active' => $t['key'] === $store->theme_key,
                'free' => $this->catalog->isFree($t['key']),
            ], array_filter($this->catalog->all(), fn (array $t) => $t['kind'] === 'store' && $t['is_active'] && $this->access->owns($tenant, $t['key'])))),
            'menus' => ['header' => $store->menus['header'] ?? [], 'footer' => $store->menus['footer'] ?? []],
            'seo' => $store->seo,
            'counts' => [
                'products' => Product::query()->where('in_store', true)->where('is_active', true)->count(),
                'categories' => Category::query()->count(),
            ],
        ];
    }

    private function tenant(Request $request): Tenant
    {
        /** @var User $user */
        $user = $request->user();

        return $user->tenant ?? abort(403);
    }
}
