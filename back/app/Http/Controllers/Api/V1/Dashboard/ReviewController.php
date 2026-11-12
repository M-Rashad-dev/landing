<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Dashboard;

use App\Http\Controllers\Concerns\RespondsWithJson;
use App\Http\Controllers\Controller;
use App\Jobs\RevalidateTenantHosts;
use App\Models\Media;
use App\Models\ProductReview;
use App\Rules\TenantExists;
use App\Tenancy\Tenancy;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * «التقييمات»: what customers wrote on the products (published at once); the merchant hides or shows them.
 */
final class ReviewController extends Controller
{
    use RespondsWithJson;

    public function index(Request $request): JsonResponse
    {
        $data = $request->validate([
            'status' => ['nullable', Rule::in(['all', 'visible', 'hidden'])],
            'rating' => ['nullable', 'integer', 'between:1,5'],
            'product_id' => ['nullable', 'integer', TenantExists::table('products')],
            'q' => ['nullable', 'string', 'max:100'],
            'page' => ['nullable', 'integer', 'min:1', 'max:10000'],
        ]);

        $query = ProductReview::query()->with(['product.media', 'customer'])
            ->when(($data['status'] ?? 'all') === 'visible', fn (Builder $q) => $q->where('is_hidden', false))
            ->when(($data['status'] ?? 'all') === 'hidden', fn (Builder $q) => $q->where('is_hidden', true))
            ->when(isset($data['rating']), fn (Builder $q) => $q->where('rating', (int) $data['rating']))
            ->when(isset($data['product_id']), fn (Builder $q) => $q->where('product_id', (int) $data['product_id']))
            ->when(! empty($data['q']), function (Builder $q) use ($data) {
                $like = '%'.addcslashes(trim((string) $data['q']), '%_\\').'%';
                $q->where(fn (Builder $w) => $w->where('text', 'like', $like)->orWhere('author_name', 'like', $like)
                    ->orWhereHas('product', fn (Builder $p) => $p->withTrashed()->where('name', 'like', $like)));
            })
            ->latest('id');
        $page = $query->paginate(20, ['*'], 'page', (int) ($data['page'] ?? 1));

        $all = ProductReview::query();
        $counts = [
            'all' => (clone $all)->count(),
            'visible' => (clone $all)->where('is_hidden', false)->count(),
            'hidden' => (clone $all)->where('is_hidden', true)->count(),
            'average' => round((float) (clone $all)->where('is_hidden', false)->avg('rating'), 1),
        ];

        return $this->ok(
            $page->getCollection()->map(fn (ProductReview $r) => $this->row($r))->values()->all(),
            ['current_page' => $page->currentPage(), 'last_page' => $page->lastPage(), 'per_page' => $page->perPage(), 'total' => $page->total(), 'counts' => $counts],
        );
    }

    public function update(Request $request, ProductReview $review): JsonResponse
    {
        $data = $request->validate(['is_hidden' => ['required', 'boolean']]);
        $review->forceFill(['is_hidden' => (bool) $data['is_hidden']])->save();
        RevalidateTenantHosts::dispatch((int) Tenancy::id())->afterCommit();

        return $this->ok($this->row($review->load(['product.media', 'customer'])));
    }

    /** @return array<string, mixed> */
    private function row(ProductReview $r): array
    {
        /** @var Media|null $image */
        $image = $r->product?->media->first();

        return [
            'id' => $r->id,
            'rating' => $r->rating,
            'text' => $r->text,
            'author_name' => $r->author_name,
            'is_hidden' => $r->is_hidden,
            'created_at' => $r->created_at->toIso8601ZuluString(),
            'product' => $r->product === null ? null : ['id' => $r->product->id, 'name' => $r->product->name, 'image' => $image?->urls(), 'deleted' => $r->product->trashed()],
            'customer' => $r->customer === null ? null : ['id' => $r->customer->id, 'name' => $r->customer->name, 'phone' => $r->customer->phone],
        ];
    }
}
