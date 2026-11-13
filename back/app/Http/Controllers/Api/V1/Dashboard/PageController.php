<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Dashboard;

use App\Actions\Pages\CreatePage;
use App\Actions\Pages\PageLifecycle;
use App\Actions\Pages\PublishPage;
use App\Actions\Pages\SavePageContent;
use App\Actions\Pages\SyncPageMedia;
use App\Enums\OrderStatus;
use App\Enums\PageStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\Dashboard\PageRequest;
use App\Http\Requests\Dashboard\SavePageContentRequest;
use App\Http\Resources\PageDetailResource;
use App\Http\Resources\PageResource;
use App\Jobs\RevalidateTenantHosts;
use App\Models\LandingPage;
use App\Models\Order;
use App\Models\PageStat;
use App\Pricing\Shipping;
use App\Services\PublicPageData;
use App\Store\Accounts\ProductReviews;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Collection;

final class PageController extends Controller
{
    private const RELATIONS = ['identity', 'product.media'];

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
            ->latest('updated_at')
            ->paginate($this->perPage($request));
        $this->attachStats($pages->getCollection());

        return $this->paginated($pages, PageResource::class, [
            'counts' => [
                'all' => LandingPage::query()->landings()->count(),
                'published' => LandingPage::query()->landings()->where('status', PageStatus::Published)->count(),
                'draft' => LandingPage::query()->landings()->where('status', PageStatus::Draft)->count(),
            ],
        ]);
    }

    /**
     * Last 30 days per page: visits (first-party counters), orders that count as sales, conversion.
     *
     * @param  Collection<int, LandingPage>  $pages
     */
    private function attachStats(Collection $pages): void
    {
        $ids = $pages->pluck('id')->all();
        if ($ids === []) {
            return;
        }
        $since = now()->subDays(30);
        $views = PageStat::query()->whereIn('landing_page_id', $ids)->where('date', '>=', $since->toDateString())
            ->selectRaw('landing_page_id, sum(views) as total')->groupBy('landing_page_id')->pluck('total', 'landing_page_id');
        $orders = Order::query()->whereIn('landing_page_id', $ids)->where('created_at', '>=', $since)
            ->whereNotIn('status', [OrderStatus::Cancelled, OrderStatus::Fake])
            ->selectRaw('landing_page_id, count(*) as total')->groupBy('landing_page_id')->pluck('total', 'landing_page_id');

        foreach ($pages as $page) {
            $v = (int) ($views[$page->id] ?? 0);
            $o = (int) ($orders[$page->id] ?? 0);
            $page->setAttribute('stats', ['views' => $v, 'orders' => $o, 'conversion' => $v > 0 ? round($o / $v * 100, 2) : null]);
        }
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
    public function preview(Request $request, LandingPage $page, PublicPageData $data, Shipping $shipping): JsonResponse
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
            'shipping' => $shipping->publicConfig(now()),
            'reviews' => $page->product_id === null ? [] : app(ProductReviews::class)->forProduct($page->product_id),
            'store_name' => (string) $request->user()?->tenant?->name,
        ]);
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
        $copy = $lifecycle->duplicate($page, $request->user()?->getAuthIdentifier());

        return $this->created(PageDetailResource::make($copy->load(self::RELATIONS))->resolve($request));
    }

    public function setHome(LandingPage $page, PageLifecycle $lifecycle): JsonResponse
    {

        return $this->ok(PageDetailResource::make($lifecycle->setHome($page)->load(self::RELATIONS)));
    }

    public function destroy(LandingPage $page, PageLifecycle $lifecycle): Response
    {
        $lifecycle->delete($page);

        return $this->noContent();
    }
}
