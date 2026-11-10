<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Dashboard;

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

/** «المتجر الإلكتروني»: create / turn on the store, its theme, settings and menus. */
final class StoreController extends Controller
{
    use RespondsWithJson;

    public function __construct(private readonly StoreSetup $setup) {}

    public function show(Request $request): JsonResponse
    {
        return $this->ok($this->row($this->tenant($request), $this->setup->current()));
    }

    /** First time: creates the store and its home with the Builder starter content sent by the dashboard. */
    public function setup(Request $request): JsonResponse
    {
        $request->validate(['content' => ['nullable', 'array']]);
        $store = $this->setup->ensure($this->tenant($request), $request->input('content'));

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
        $home = $store->homePage;

        return [
            'exists' => true,
            'is_enabled' => $store->is_enabled,
            'live' => $this->setup->isLive($tenant, $store) && $home?->isPublished() === true,
            'theme_key' => $store->theme_key,
            'home' => $home === null ? null : ['id' => $home->id, 'status' => $home->status->value, 'published_at' => $home->published_at?->toIso8601ZuluString(), 'has_unpublished_changes' => $home->hasUnpublishedChanges()],
            'settings' => $store->resolvedSettings(),
            'menus' => ['header' => $store->menus['header'] ?? [], 'footer' => $store->menus['footer'] ?? []],
            'seo' => $store->seo,
            // Setup checklist for the dashboard.
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
