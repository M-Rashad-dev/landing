<?php

declare(strict_types=1);

namespace App\Ai\Quiz;

use App\Ai\Ai;
use App\Ai\AiUnavailable;
use App\Ai\Knowledge;
use App\Models\Product;
use App\Models\ProductVector;

/**
 * Store products as vectors (name + description) for the AI quiz: out of a big catalog, the products
 * nearest to a customer's answers are the only ones sent to the model. Runs in the store's tenant.
 */
final class ProductVectors
{
    public function __construct(private readonly Ai $ai) {}

    /** The text a product's vector is made of (name, short and long description, cut). */
    public static function text(Product $product): string
    {
        $parts = [$product->name, (string) $product->short_description, strip_tags((string) $product->description)];

        return mb_substr(trim((string) preg_replace('/\s+/u', ' ', implode(' — ', array_filter($parts, fn ($p) => trim($p) !== '')))), 0, 1200);
    }

    /**
     * Gives a vector to the store's products without a current one (new, changed, or of another model).
     *
     * @param  list<int>  $ids  the products to cover (empty = every sellable one)
     */
    public function embedMissing(array $ids, int $max = 3000): int
    {
        $model = Ai::model('embedding');
        $have = ProductVector::query()->where('model', $model)->pluck('hash', 'product_id');
        $products = Product::query()->where('in_store', true)->where('is_active', true)
            ->when($ids !== [], fn ($q) => $q->whereIn('id', $ids))
            ->orderByDesc('id')->limit($max)->get(['id', 'name', 'short_description', 'description']);

        $pending = $products->filter(fn (Product $p) => ($have[$p->id] ?? null) !== sha1(self::text($p)))->values();
        $done = 0;
        foreach ($pending->chunk(max(1, (int) config('ai.knowledge.batch', 10))) as $batch) {
            $texts = $batch->map(fn (Product $p) => self::text($p))->values()->all();
            try {
                $result = $this->ai->embed('quiz', 'embedding', $texts, $batch->first()?->tenant_id);
            } catch (AiUnavailable) {
                break;
            }
            foreach ($batch->values() as $i => $product) {
                $vector = $result->vectors[$i] ?? null;
                if (! is_array($vector) || $vector === []) {
                    continue;
                }
                ProductVector::query()->updateOrCreate(['product_id' => $product->id], ['hash' => sha1($texts[$i]), 'model' => $result->model, 'vector' => $vector]);
                $done++;
            }
        }

        return $done;
    }

    /**
     * The products of the list nearest to the question, best first; null when too few of them have a
     * vector of the current model yet (the caller ranks by words instead).
     *
     * @param  list<int>  $ids
     * @param  list<float>  $query
     * @return list<int>|null
     */
    public function nearest(array $ids, array $query, int $top): ?array
    {
        $rows = ProductVector::query()->where('model', Ai::model('embedding'))->whereIn('product_id', $ids)->get(['product_id', 'vector']);
        if ($rows->count() < count($ids) * 0.8) {
            return null;
        }
        $scored = $rows->map(fn (ProductVector $v) => [$v->product_id, Knowledge::cosine($query, $v->vector)])->sortByDesc(1)->values();

        return $scored->take($top)->pluck(0)->map(fn ($id) => (int) $id)->all();
    }
}
