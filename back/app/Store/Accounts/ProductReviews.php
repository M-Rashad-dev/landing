<?php

declare(strict_types=1);

namespace App\Store\Accounts;

use App\Enums\OrderStatus;
use App\Jobs\RevalidateTenantHosts;
use App\Models\Customer;
use App\Models\OrderItem;
use App\Models\ProductReview;
use App\Tenancy\Tenancy;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Validation\ValidationException;

/**
 * Product reviews (owner's rules): only a customer with a delivered order that has the product
 * can review it, one review per product (writing again edits it); published at once, the
 * merchant can hide it. Runs inside the store's tenant context.
 */
final class ProductReviews
{
    /** The delivered order of the customer that has the product, or null. */
    public function deliveredOrderId(Customer $customer, int $productId): ?int
    {
        $id = OrderItem::query()
            ->where('product_id', $productId)
            ->whereHas('order', fn (Builder $q) => $q->where('customer_id', $customer->id)->where('status', OrderStatus::Delivered))
            ->latest('order_id')
            ->value('order_id');

        return $id === null ? null : (int) $id;
    }

    public function write(Customer $customer, int $productId, int $rating, ?string $text): ProductReview
    {
        $orderId = $this->deliveredOrderId($customer, $productId);
        if ($orderId === null) {
            throw ValidationException::withMessages(['product_id' => [__('accounts.review_not_allowed')]]);
        }
        $text = $text === null ? null : trim(strip_tags($text));

        $review = ProductReview::query()->updateOrCreate(
            ['product_id' => $productId, 'customer_id' => $customer->id],
            [
                'order_id' => $orderId,
                'rating' => $rating,
                'text' => $text === '' ? null : $text,
                'author_name' => trim((string) $customer->name) !== '' ? (string) $customer->name : (string) __('accounts.anonymous'),
            ],
        );
        RevalidateTenantHosts::dispatch((int) Tenancy::id())->afterCommit();

        return $review;
    }

    /**
     * Average and count of the visible reviews per product.
     *
     * @param  list<int>  $productIds
     * @return array<int, array{average: float, count: int}>
     */
    public function summaries(array $productIds): array
    {
        if ($productIds === []) {
            return [];
        }

        return ProductReview::query()->visible()->whereIn('product_id', $productIds)
            ->selectRaw('product_id, avg(rating) as average, count(*) as total')
            ->groupBy('product_id')
            ->get()
            ->mapWithKeys(fn ($row) => [(int) $row->product_id => ['average' => round((float) $row->average, 1), 'count' => (int) $row->total]])
            ->all();
    }

    /** @return array{average: float, count: int, stars: array<int, int>} */
    public function summary(int $productId): array
    {
        $stars = ProductReview::query()->visible()->where('product_id', $productId)
            ->selectRaw('rating, count(*) as total')->groupBy('rating')->pluck('total', 'rating')->map(fn ($n) => (int) $n)->all();
        $count = array_sum($stars);
        $sum = 0;
        foreach ($stars as $rating => $n) {
            $sum += (int) $rating * $n;
        }

        return [
            'average' => $count === 0 ? 0.0 : round($sum / $count, 1),
            'count' => $count,
            'stars' => array_map(fn (int $r) => $stars[$r] ?? 0, [5 => 5, 4 => 4, 3 => 3, 2 => 2, 1 => 1]),
        ];
    }

    /**
     * The latest good reviews with words (the home «آراء العملاء» set to automatic).
     *
     * @return list<array{name: string, rating: int, text: string}>
     */
    /**
     * The good written reviews of one product (a landing page set to show reviews by itself).
     *
     * @return list<array{name: string, rating: int, text: string}>
     */
    public function forProduct(int $productId, int $limit = 9): array
    {
        return ProductReview::query()->visible()->where('product_id', $productId)->where('rating', '>=', 4)->whereNotNull('text')
            ->latest('id')->limit($limit)->get()
            ->map(fn (ProductReview $r) => ['name' => ProductReview::displayName($r->author_name), 'rating' => $r->rating, 'text' => (string) $r->text])
            ->values()
            ->all();
    }

    public function forHome(int $limit = 6): array
    {
        return ProductReview::query()->visible()->where('rating', '>=', 4)->whereNotNull('text')
            ->whereHas('product', fn (Builder $q) => $q->whereNull('deleted_at'))
            ->latest('id')->limit($limit)->get()
            ->map(fn (ProductReview $r) => ['name' => ProductReview::displayName($r->author_name), 'rating' => $r->rating, 'text' => (string) $r->text])
            ->all();
    }
}
