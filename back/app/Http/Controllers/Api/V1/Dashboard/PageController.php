<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Dashboard;

use App\Actions\Pages\CreatePage;
use App\Actions\Pages\PageLifecycle;
use App\Actions\Pages\PublishPage;
use App\Actions\Pages\SavePageContent;
use App\Actions\Pages\SyncPageMedia;
use App\Exceptions\ApiException;
use App\Http\Controllers\Controller;
use App\Http\Requests\Dashboard\PageRequest;
use App\Http\Requests\Dashboard\SavePageContentRequest;
use App\Http\Resources\PageDetailResource;
use App\Http\Resources\PageResource;
use App\Jobs\RevalidateTenantHosts;
use App\Models\LandingPage;
use App\Models\Product;
use App\Pricing\Shipping;
use App\Services\PublicPageData;
use App\Store\StoreCatalog;
use App\Store\StoreSite;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

final class PageController extends Controller
{
    private const RELATIONS = ['identity', 'product'];

    public function index(Request $request): JsonResponse
    {
        $search = trim((string) $request->query('q', ''));
        $status = (string) $request->query('status', '');

        // The store home is edited from «المتجر», not listed with the landing pages.
        $pages = LandingPage::query()
            ->landings()
            ->with(self::RELATIONS)
            ->when($search !== '', fn ($q) => $q->where(fn ($w) => $w->where('title', 'like', '%'.addcslashes($search, '%_\\').'%')->orWhere('slug', 'like', '%'.addcslashes($search, '%_\\').'%')))
            ->when(in_array($status, ['draft', 'published'], true), fn ($q) => $q->where('status', $status))
            ->orderByDesc('is_home')
            ->latest('updated_at')
            ->paginate($this->perPage($request));

        return $this->paginated($pages, PageResource::class);
    }

    public function store(PageRequest $request, CreatePage $action): JsonResponse
    {
        /** @var array{title: string, slug: string, theme_key: string, identity_id?: int|null, product_id?: int|null, content?: mixed} $data */
        $data = $request->validated();
        $page = $action->handle($data, $request->user()?->getAuthIdentifier());

        return $this->created(PageDetailResource::make($page->load(self::RELATIONS))->resolve($request));
    }

    public function show(LandingPage $page): JsonResponse
    {
        return $this->ok(PageDetailResource::make($page->load(self::RELATIONS)));
    }

    public function update(PageRequest $request, LandingPage $page, SyncPageMedia $syncMedia): JsonResponse
    {
        $page->fill([
            'title' => $request->validated('title'),
            'slug' => $request->validated('slug'),
            'identity_id' => (int) $request->validated('identity_id'),
            'product_id' => $request->validated('product_id'),
        ]);

        if ($request->has('seo_override')) {
            $page->seo_override = $request->seoOverride();
        }
        if ($request->has('tracking_override')) {
            $page->tracking_override = $request->trackingOverride();
        }

        $affectsPublic = $page->isPublished() && $page->isDirty(['slug', 'identity_id', 'product_id', 'seo_override', 'tracking_override', 'title']);
        $page->save();
        $syncMedia->handle($page);

        if ($affectsPublic) {
            RevalidateTenantHosts::dispatch($page->tenant_id)->afterCommit();
        }

        return $this->ok(PageDetailResource::make($page->load(self::RELATIONS)));
    }

    /** Data for the Builder preview iframe: draft content + the same public shapes the live page uses. */
    public function preview(LandingPage $page, PublicPageData $data, Shipping $shipping): JsonResponse
    {
        $page->load(['identity', 'product']);

        return $this->ok([
            'page' => ['id' => $page->id, 'slug' => $page->slug, 'title' => $page->title],
            'theme_key' => $page->theme_key,
            'content' => $page->draft_content,
            'identity' => $page->identity ? $data->identity($page->identity) : null,
            'product' => $data->product($page->product),
            'offers' => $data->offers($page->product, now()),
            'media' => (object) $data->media($page->draft_content),
            'shipping' => $shipping->publicConfig(),
            // A store home previews its sections with the real catalog.
            'store' => $page->isStoreHome() ? $this->storePreview($page) : null,
        ]);
    }

    /** @return array<string, mixed> */
    private function storePreview(LandingPage $page): array
    {
        $catalog = app(StoreCatalog::class);
        $sample = $catalog->sellable()->with(['media', 'variants', 'options', 'categories:id'])->orderByDesc('id')->limit(48)->get()
            ->map(fn (Product $p) => [...$catalog->card($p), 'category_ids' => $p->categories->pluck('id')->all()])->all();

        return [
            'categories' => $catalog->categoryRows(),
            'products' => app(StoreSite::class)->sectionData((array) $page->draft_content)['products'],
            'sample' => $sample,
        ];
    }

    public function saveContent(SavePageContentRequest $request, LandingPage $page, SavePageContent $action): JsonResponse
    {
        $page = $action->handle($page, (int) $request->validated('version'), $request->validated('content'), $request->validated('theme_key'));

        return $this->ok(PageDetailResource::make($page->load(self::RELATIONS)));
    }

    public function publish(LandingPage $page, PublishPage $action): JsonResponse
    {
        return $this->ok(PageDetailResource::make($action->handle($page)->load(self::RELATIONS)));
    }

    public function unpublish(LandingPage $page, PageLifecycle $lifecycle): JsonResponse
    {
        return $this->ok(PageDetailResource::make($lifecycle->unpublish($page)->load(self::RELATIONS)));
    }

    public function duplicate(Request $request, LandingPage $page, PageLifecycle $lifecycle): JsonResponse
    {
        $this->notStoreHome($page);
        $copy = $lifecycle->duplicate($page, $request->user()?->getAuthIdentifier());

        return $this->created(PageDetailResource::make($copy->load(self::RELATIONS))->resolve($request));
    }

    public function setHome(LandingPage $page, PageLifecycle $lifecycle): JsonResponse
    {
        $this->notStoreHome($page);

        return $this->ok(PageDetailResource::make($lifecycle->setHome($page)->load(self::RELATIONS)));
    }

    public function destroy(LandingPage $page, PageLifecycle $lifecycle): Response
    {
        $this->notStoreHome($page);
        $lifecycle->delete($page);

        return $this->noContent();
    }

    /** The store home lives in «المتجر»: it is not copied, deleted or made the landing home. */
    private function notStoreHome(LandingPage $page): void
    {
        if ($page->isStoreHome()) {
            throw new ApiException(422, 'store_home', __('pages.store_home_locked'));
        }
    }
}
