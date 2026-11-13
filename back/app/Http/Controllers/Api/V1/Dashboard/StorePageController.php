<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Dashboard;

use App\Billing\Entitlements;
use App\Enums\PlanFeature;
use App\Exceptions\ApiException;
use App\Http\Controllers\Concerns\RespondsWithJson;
use App\Http\Controllers\Controller;
use App\Models\StorePage;
use App\Rules\PageSlug;
use App\Rules\TenantExists;
use App\Rules\TenantUnique;
use App\Support\Slugs;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;

/** «صفحات المتجر»: about us, shipping, return policy… at /pages/{slug}. */
final class StorePageController extends Controller
{
    use RespondsWithJson;

    public function index(): JsonResponse
    {
        return $this->ok(StorePage::query()->orderBy('position')->orderBy('id')->get()->map(fn (StorePage $p) => $this->row($p))->all());
    }

    public function store(Request $request, Entitlements $entitlements): JsonResponse
    {
        $entitlements->ensure(PlanFeature::Store);
        if (StorePage::query()->count() >= (int) config('landing.limits.store_pages')) {
            throw new ApiException(422, 'limit_reached', __('pages.too_many_items', ['max' => config('landing.limits.store_pages')]));
        }
        $data = $this->validated($request, null);
        $page = StorePage::query()->create($data + [
            'slug' => $data['slug'] ?? Slugs::unique(StorePage::query(), $data['title']),
            'position' => (int) StorePage::query()->max('position') + 1,
        ]);

        return $this->created($this->row($page));
    }

    public function update(Request $request, StorePage $storePage): JsonResponse
    {
        $data = $this->validated($request, $storePage);
        $storePage->update(array_filter($data, fn ($v, $k) => $k !== 'slug' || $v !== null, ARRAY_FILTER_USE_BOTH));

        return $this->ok($this->row($storePage));
    }

    /** The order of the pages in the store footer. */
    public function reorder(Request $request): Response
    {
        $data = $request->validate(['ids' => ['required', 'array', 'max:50'], 'ids.*' => ['integer', 'distinct', TenantExists::table('store_pages')]]);
        DB::transaction(function () use ($data) {
            foreach (array_values($data['ids']) as $position => $id) {
                StorePage::query()->whereKey((int) $id)->first()?->update(['position' => $position + 1]);
            }
        });

        return $this->noContent();
    }

    public function destroy(StorePage $storePage): Response
    {
        $storePage->delete();

        return $this->noContent();
    }

    /** @return array<string, mixed> */
    private function validated(Request $request, ?StorePage $page): array
    {
        $data = $request->validate([
            'title' => ['required', 'string', 'max:120'],
            'slug' => ['nullable', 'string', 'max:120', 'regex:'.PageSlug::PATTERN, TenantUnique::table('store_pages', 'slug')->ignore($page?->id)],
            'body' => ['nullable', 'string', 'max:20000'],
            'is_published' => ['sometimes', 'boolean'],
            'seo' => ['sometimes', 'nullable', 'array'],
            'seo.title' => ['nullable', 'string', 'max:70'],
            'seo.description' => ['nullable', 'string', 'max:170'],
        ]);
        $data['title'] = trim(strip_tags($data['title']));
        if (isset($data['seo'])) {
            $data['seo'] = array_filter((array) $data['seo'], fn ($v) => $v !== null && $v !== '') ?: null;
        }

        return $data;
    }

    /** @return array<string, mixed> */
    private function row(StorePage $p): array
    {
        return ['id' => $p->id, 'title' => $p->title, 'slug' => $p->slug, 'body' => $p->body, 'is_published' => $p->is_published, 'seo' => $p->seo, 'position' => $p->position];
    }
}
