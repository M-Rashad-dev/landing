<?php

declare(strict_types=1);

namespace App\Store\Questions;

use App\Exceptions\ApiException;
use App\Http\Controllers\Api\V1\Public\StoreController as PublicStoreController;
use App\Jobs\RevalidateTenantHosts;
use App\Models\Media;
use App\Models\Product;
use App\Models\ProductQuestion;
use App\Models\Store;
use App\Notifications\StoreNotices;
use App\Services\FormToken;
use App\Services\PhoneNormalizer;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\RateLimiter;

/**
 * «أسئلة العملاء» (docs/plans/tekno/PLAN.md §3): a visitor asks from the product page, the merchant answers in the
 * dashboard (or through the copilot, the same rules), and the product page shows the answered ones he published.
 */
final class ProductQuestions
{
    /** Published answers sent with a product page (the latest ones). */
    public const PUBLIC_LIMIT = 20;

    /** Questions one visitor may send a store in an hour. */
    public const PER_VISITOR = 5;

    public const STATUSES = ['unanswered', 'published', 'hidden'];

    public const ANSWER_MAX = 2000;

    public function __construct(
        private readonly FormToken $tokens,
        private readonly PhoneNormalizer $phones,
        private readonly StoreNotices $notices,
    ) {}

    /**
     * A visitor's question (already validated: name, phone?, question). A bot (filled honeypot, missing or bad form
     * token) is answered the same and nothing is kept. Null = not kept.
     *
     * @param  array<string, mixed>  $data
     */
    public function ask(Store $store, Product $product, array $data): ?ProductQuestion
    {
        if (! $store->questions_enabled) {
            throw new ApiException(404, 'not_found', __('questions.off'));
        }
        if (trim((string) ($data['website'] ?? '')) !== '' || ! $this->tokens->isValid($data['form_token'] ?? null, PublicStoreController::formSubject($store))) {
            return null;
        }

        // 5 an hour per visitor and store (a visitor without an IP is bounded by the route's own limit).
        $ip = is_string($data['ip'] ?? null) && $data['ip'] !== '' ? $data['ip'] : null;
        $key = 'questions:'.$store->tenant_id.':'.$ip;
        if ($ip !== null && RateLimiter::tooManyAttempts($key, self::PER_VISITOR)) {
            throw new ApiException(429, 'too_many_questions', __('questions.too_many'));
        }

        $question = ProductQuestion::query()->create([
            'product_id' => $product->id,
            'name' => trim(strip_tags((string) $data['name'])),
            'phone' => $this->phones->normalize(isset($data['phone']) ? (string) $data['phone'] : null),
            'question' => trim(strip_tags((string) $data['question'])),
        ]);
        if ($ip !== null) {
            RateLimiter::hit($key, 3600);
        }
        $this->notices->productQuestion($question, $product->name);

        return $question;
    }

    /**
     * What a product page shows: the published answers (latest first, at most 20) and how many there are; null when
     * the store turned questions off (no block, no form).
     *
     * @return array{count: int, items: list<array<string, mixed>>}|null
     */
    public function forProduct(Store $store, int $productId): ?array
    {
        if (! $store->questions_enabled) {
            return null;
        }
        $query = ProductQuestion::query()->published()->where('product_id', $productId);

        return [
            'count' => (clone $query)->count(),
            'items' => $query->orderByDesc('answered_at')->orderByDesc('id')->limit(self::PUBLIC_LIMIT)->get()
                ->map(fn (ProductQuestion $q) => $q->toPublic())->values()->all(),
        ];
    }

    /**
     * The merchant's answer and whether it shows on the product page. An empty answer takes the question back to
     * «مستني رد» (and off the page); a new or changed answer is dated now.
     *
     * @param  array{answer?: string|null, is_published?: bool}  $data  validated ProductQuestionRequest data
     */
    public function answer(ProductQuestion $question, array $data): ProductQuestion
    {
        $answer = array_key_exists('answer', $data) ? self::clean($data['answer']) : $question->answer;
        $published = array_key_exists('is_published', $data) ? (bool) $data['is_published'] : $question->is_published;
        $wasVisible = $question->status() === 'published';

        $question->answer = $answer;
        if ($answer === null) {
            $question->answered_at = null;
            $question->is_published = false;
        } else {
            if ($question->answered_at === null || $question->isDirty('answer')) {
                $question->answered_at = now();
            }
            $question->is_published = $published;
        }
        $question->save();

        if ($wasVisible || $question->status() === 'published') {
            RevalidateTenantHosts::dispatch($question->tenant_id)->afterCommit();
        }

        return $question;
    }

    public function delete(ProductQuestion $question): void
    {
        $wasVisible = $question->status() === 'published';
        $question->delete();
        if ($wasVisible) {
            RevalidateTenantHosts::dispatch($question->tenant_id)->afterCommit();
        }
    }

    /** The store's switch: questions on every product page, or none. */
    public function setEnabled(Store $store, bool $enabled): void
    {
        // Store::saved refreshes the cached pages.
        $store->forceFill(['questions_enabled' => $enabled])->save();
    }

    /**
     * The dashboard list (and the copilot's): the unanswered first, then the newest.
     *
     * @return Builder<ProductQuestion>
     */
    public function listQuery(?string $status = null, ?string $search = null, ?int $productId = null): Builder
    {
        return ProductQuestion::query()->with(['product.media'])
            ->when($status === 'unanswered', fn (Builder $q) => $q->whereNull('answered_at'))
            ->when($status === 'published', fn (Builder $q) => $q->whereNotNull('answered_at')->where('is_published', true))
            ->when($status === 'hidden', fn (Builder $q) => $q->whereNotNull('answered_at')->where('is_published', false))
            ->when($productId !== null, fn (Builder $q) => $q->where('product_id', $productId))
            ->when($search !== null && trim($search) !== '', function (Builder $q) use ($search) {
                $like = '%'.addcslashes(trim((string) $search), '%_\\').'%';
                $q->where(fn (Builder $w) => $w->where('question', 'like', $like)->orWhere('answer', 'like', $like)->orWhere('name', 'like', $like)
                    ->orWhereHas('product', fn (Builder $p) => $p->withTrashed()->where('name', 'like', $like)));
            })
            ->orderByRaw('answered_at is not null')
            ->orderByDesc('id');
    }

    /** @return array{all: int, unanswered: int, published: int, hidden: int} */
    public function counts(): array
    {
        $all = ProductQuestion::query();

        return [
            'all' => (clone $all)->count(),
            'unanswered' => (clone $all)->whereNull('answered_at')->count(),
            'published' => (clone $all)->whereNotNull('answered_at')->where('is_published', true)->count(),
            'hidden' => (clone $all)->whereNotNull('answered_at')->where('is_published', false)->count(),
        ];
    }

    /** One question in the dashboard (with the asker's phone, for the merchant only). @return array<string, mixed> */
    public function row(ProductQuestion $q): array
    {
        /** @var Media|null $image */
        $image = $q->product?->media->first();

        return [
            'id' => $q->id,
            'name' => $q->name,
            'phone' => $q->phone,
            'question' => $q->question,
            'answer' => $q->answer,
            'answered_at' => $q->answered_at?->toIso8601ZuluString(),
            'is_published' => $q->is_published,
            'status' => $q->status(),
            'created_at' => $q->created_at->toIso8601ZuluString(),
            'product' => $q->product === null ? null : [
                'id' => $q->product->id,
                'name' => $q->product->name,
                'slug' => $q->product->slug,
                'image' => $image?->urls(),
                'deleted' => $q->product->trashed(),
            ],
        ];
    }

    private static function clean(mixed $answer): ?string
    {
        $text = is_string($answer) ? trim(strip_tags($answer)) : '';

        return $text === '' ? null : $text;
    }
}
