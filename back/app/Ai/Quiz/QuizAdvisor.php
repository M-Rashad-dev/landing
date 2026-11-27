<?php

declare(strict_types=1);

namespace App\Ai\Quiz;

use App\Ai\Ai;
use App\Ai\AiUnavailable;
use App\Ai\Designer\AiDesigner;
use App\Exceptions\ApiException;
use App\Jobs\EmbedProductVectors;
use App\Models\Product;
use App\Models\ProductVector;
use App\Models\Store;
use App\Store\Categories;
use App\Store\QuizResults;
use App\Store\SeoDefaults;
use App\Store\StoreCatalog;
use App\Themes\Store\StoreSections;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\Cache;
use Illuminate\Validation\ValidationException;
use Throwable;

/**
 * «اختبار البشرة» with AI (the merchant's add-on, paid from the store's AI balance). The merchant's
 * questions stay fixed; the AI reads the answers (and the customer's own words, when the merchant
 * asks for them), picks one of the merchant's results and up to 4 of the store's products, and
 * writes a short explanation. Only the store's products are offered to it and its picks are checked
 * here. Anything wrong (AI off, balance out, a failed call) falls back to the
 * vote result, which the visitor sees as usual. The same answers get the same recommendation (cached).
 * Runs inside the store's tenant.
 */
final class QuizAdvisor
{
    /**
     * Words in her note that call for a dermatologist (the sentence is added here when the model leaves it out):
     * skin diseases, allergies, inflammation, wounds, pregnancy and breastfeeding, medicines.
     */
    // Not «حمل» / «دواير» alone: «مش بتتحمل» and dark circles («دواير») are everyday skin talk.
    private const MEDICAL = '/(?:[اأإ]كزيما|صدفي|حساسي|روزاسيا|وردي[ةه]|التهاب|ملته|جرح|جروح|حرق|حروق|حامل|الحمل|رضاع|برضّ?ع|دكتور|طبيب|علاج|روشت|دواء|دوا(?!ئر|ير)|مرض|بهاق|فطري|هرش شديد)/u';

    public function __construct(
        private readonly Ai $ai,
        private readonly StoreCatalog $catalog,
        private readonly Categories $categories,
        private readonly ProductVectors $vectors,
        private readonly QuizResults $results,
        private readonly SeoDefaults $seo,
    ) {}

    /**
     * @param  list<int>  $answers  the answer picked for each question, in order
     * @return array{source: 'ai'|'vote', result_id: string, text?: string, products?: list<array<string, mixed>>}
     */
    public function advise(Store $store, string $sectionId, array $answers, ?string $note): array
    {
        $section = collect((array) ($store->design()?->published['sections'] ?? []))
            ->first(fn ($s) => is_array($s) && ($s['id'] ?? null) === $sectionId && ($s['type'] ?? null) === 'skin_quiz');
        if (! is_array($section)) {
            throw new ApiException(404, 'not_found', (string) __('landing.not_found'));
        }
        $props = (array) $section['props'];
        $questions = (array) $props['questions'];
        $results = array_values((array) $props['results']);
        if (count($answers) !== count($questions) || collect($answers)->contains(fn ($a, $q) => ! isset($questions[$q]['answers'][$a]))) {
            throw ValidationException::withMessages(['answers' => __('ai.quiz.wrong_answers')]);
        }

        $vote = self::vote($props, $answers);
        $voteId = (string) $results[$vote]['id'];
        $settings = StoreSections::cleanQuizAi(is_array($props['ai'] ?? null) ? $props['ai'] : []);
        $note = $settings['open_question'] ? self::cleanNote($note) : null;
        $fallback = function () use ($store, $sectionId, $voteId): array {
            $this->results->record($store, $sectionId, $voteId);

            return ['source' => 'vote', 'result_id' => $voteId];
        };
        if (! $settings['enabled']) {
            return $fallback();
        }

        // The same answers to the same quiz keep the same recommendation (no new charge).
        $key = 'quiz-ai:'.$store->tenant_id.':'.$sectionId.':'.sha1((string) json_encode([$answers, $note, $props, Ai::model('quiz')], JSON_UNESCAPED_UNICODE));
        $picked = Cache::get($key);
        if (! is_array($picked)) {
            if (! $this->ai->available('quiz')) {
                return $fallback();
            }
            $picked = $this->ask($store, $props, $settings, $answers, $note, $voteId);
            if ($picked === null) {
                return $fallback();
            }
            Cache::put($key, $picked, now()->addDays((int) config('ai.quiz.cache_days', 7)));
        }

        $result = collect($results)->firstWhere('id', $picked['result_id']) ?? $results[$vote];
        $products = $this->catalog->cards($picked['product_ids'] !== [] ? $picked['product_ids'] : array_map('intval', (array) $result['product_ids']));
        $this->results->record($store, $sectionId, (string) $result['id'], true);

        return ['source' => 'ai', 'result_id' => (string) $result['id'], 'text' => $picked['text'], 'products' => $products];
    }

    /**
     * The result with the most votes from the answers picked (a tie goes to the result listed first),
     * the same count the storefront makes.
     *
     * @param  array<string, mixed>  $props
     * @param  list<int>  $answers
     */
    public static function vote(array $props, array $answers): int
    {
        $votes = [];
        foreach ($answers as $q => $a) {
            foreach ((array) ($props['questions'][$q]['answers'][$a]['results'] ?? []) as $id) {
                $votes[$id] = ($votes[$id] ?? 0) + 1;
            }
        }
        $best = 0;
        foreach (array_values((array) $props['results']) as $i => $result) {
            if (($votes[$result['id']] ?? 0) > ($votes[$props['results'][$best]['id']] ?? 0)) {
                $best = $i;
            }
        }

        return $best;
    }

    /**
     * The quiz data, then the answer's shape again (some models echo the input back otherwise).
     *
     * @param  array<string, mixed>  $payload
     */
    public static function userMessage(array $payload): string
    {
        return "The finished quiz (JSON):\n".json_encode($payload, JSON_UNESCAPED_UNICODE)
            ."\n\nAnswer with ONE JSON object and nothing else, exactly this shape: "
            .'{"result_id": "<one of results.id>", "text": "<2-4 short Egyptian Arabic sentences for her>", "product_ids": [<2-4 ids from products>]}';
    }

    /** The customer's own words as data: no tags, one line, at most 300 characters (null when empty). */
    public static function cleanNote(?string $note): ?string
    {
        $note = trim((string) preg_replace('/\s+/u', ' ', strip_tags((string) $note)));

        return $note === '' ? null : mb_substr($note, 0, 300);
    }

    /**
     * Asks the model; null when it can't be asked or answers nothing usable (nothing charged then,
     * or the call is charged and the vote result shown).
     *
     * @param  array<string, mixed>  $props
     * @param  array{scope: string, category_ids: list<int>, product_ids: list<int>}  $settings
     * @param  list<int>  $answers
     * @return array{result_id: string, text: string, product_ids: list<int>}|null
     */
    private function ask(Store $store, array $props, array $settings, array $answers, ?string $note, string $voteId): ?array
    {
        $results = array_values((array) $props['results']);
        $voteResult = collect($results)->firstWhere('id', $voteId);
        $picked = [];
        foreach ($answers as $q => $a) {
            $picked[] = ['question' => (string) $props['questions'][$q]['text'], 'answer' => (string) $props['questions'][$q]['answers'][$a]['text']];
        }
        $query = implode(' — ', [...array_column($picked, 'answer'), (string) ($voteResult['name'] ?? ''), (string) $note]);

        try {
            $candidates = $this->candidates($store, $settings, array_map('intval', (array) ($voteResult['product_ids'] ?? [])), $query);
            if ($candidates->isEmpty()) {
                return null;
            }
            $payload = [
                'store' => $this->seo->storeName(),
                'quiz' => (string) $props['title'],
                'results' => array_map(fn (array $r) => ['id' => (string) $r['id'], 'name' => (string) $r['name'], 'text' => $r['text']], $results),
                'vote_result' => $voteId,
                'answers' => $picked,
                'customer_note' => $note,
                'products' => $candidates->map(fn (Product $p) => [
                    'id' => $p->id,
                    'name' => $p->name,
                    'price' => (string) $p->price,
                    'about' => mb_substr(trim((string) preg_replace('/\s+/u', ' ', strip_tags((string) ($p->short_description ?: $p->description)))), 0, 220),
                ])->values()->all(),
            ];
            $reply = $this->ai->chatPaid(
                $store->tenant ?? throw new AiUnavailable(AiUnavailable::FAILED),
                'quiz',
                'quiz',
                [
                    ['role' => 'system', 'content' => (string) file_get_contents(resource_path('prompts/quiz-advisor.md'))],
                    ['role' => 'user', 'content' => self::userMessage($payload)],
                ],
                // No JSON mode: on qwen it answers with a piece of the input; the shape asked in words works (decodeJson reads it).
                ['max_tokens' => (int) config('ai.quiz.max_output', 700), 'temperature' => 0.3],
                (string) __('ai.quiz.charge'),
            );
        } catch (AiUnavailable|ApiException) {
            // AI off or busy, balance out: the vote result (nothing charged).
            return null;
        } catch (Throwable $e) {
            report($e);

            return null;
        }

        $json = AiDesigner::decodeJson($reply->text);
        if (! is_array($json)) {
            return null;
        }
        $ids = array_column($results, 'id');
        $resultId = is_string($json['result_id'] ?? null) && in_array($json['result_id'], $ids, true) ? $json['result_id'] : $voteId;
        // Only products it was offered (the store's own, sellable), each once, at most 4.
        $allowed = $candidates->pluck('id')->all();
        $productIds = array_values(array_slice(array_unique(array_filter(array_map('intval', (array) ($json['product_ids'] ?? [])), fn (int $id) => in_array($id, $allowed, true))), 0, 4));
        $text = trim((string) preg_replace(['~https?://\S+~u', '/[ \t]+/u'], ['', ' '], strip_tags((string) ($json['text'] ?? ''))));
        $result = collect($results)->firstWhere('id', $resultId);
        $text = mb_substr($text !== '' ? $text : (string) ($result['text'] ?? ''), 0, 520);
        if ($note !== null && preg_match(self::MEDICAL, $note) === 1 && ! preg_match('/دكتور|طبيب/u', $text)) {
            $text = preg_replace('/[\s.،]+$/u', '', $text).'. '.__('ai.quiz.see_doctor');
        }

        return [
            'result_id' => $resultId,
            'text' => $text,
            'product_ids' => $productIds,
        ];
    }

    /**
     * The products the model chooses from: the merchant's scope (every sellable product, some
     * categories, or a list). A bigger set is cut to the nearest ones (vectors, or words while the
     * vectors are being made); the vote result's own products always stay in.
     *
     * @param  array{scope: string, category_ids: list<int>, product_ids: list<int>}  $settings
     * @param  list<int>  $mustKeep
     * @return Collection<int, Product>
     */
    private function candidates(Store $store, array $settings, array $mustKeep, string $query): Collection
    {
        $limit = max(5, (int) config('ai.quiz.candidates', 45));
        $base = $this->catalog->sellable();
        if ($settings['scope'] === 'products') {
            $base->whereIn('id', $settings['product_ids'] === [] ? [0] : $settings['product_ids']);
        } elseif ($settings['scope'] === 'categories') {
            $ids = collect($settings['category_ids'])->flatMap(fn (int $id) => $this->categories->withDescendants($id))->unique()->values()->all();
            $base->whereHas('categories', fn (Builder $q) => $q->whereIn('categories.id', $ids === [] ? [0] : $ids));
        }
        $pool = $base->orderByDesc('id')->limit(3000)->get(['id', 'tenant_id', 'name', 'short_description', 'description', 'price']);
        if ($pool->count() <= $limit) {
            return $pool;
        }

        $ids = $pool->pluck('id')->all();
        $ranked = null;
        $ready = ProductVector::query()->where('model', Ai::model('embedding'))->whereIn('product_id', $ids)->count() >= count($ids) * 0.8;
        if ($ready) {
            $vector = $this->ai->embed('quiz', 'embedding', [mb_substr($query, 0, 1000)], $store->tenant_id)->vectors[0] ?? [];
            $ranked = $vector === [] ? null : $this->vectors->nearest($ids, $vector, $limit);
        } else {
            EmbedProductVectors::dispatch($store->tenant_id, $settings['scope'] === 'all' ? [] : $ids);
        }
        $ranked ??= self::byWords($pool, $query, $limit);

        $order = array_slice(array_values(array_unique([...array_intersect($mustKeep, $ids), ...$ranked])), 0, $limit);
        $byId = $pool->keyBy('id');

        return new Collection(array_map(fn (int $id) => $byId->get($id), $order));
    }

    /**
     * Products ranked by the words of the answers found in their name and description (while the
     * store's vectors are being made).
     *
     * @param  Collection<int, Product>  $pool
     * @return list<int>
     */
    public static function byWords(Collection $pool, string $query, int $top): array
    {
        $words = array_values(array_filter(array_unique(preg_split('/[^\p{L}\p{N}]+/u', mb_strtolower($query)) ?: []), fn ($w) => mb_strlen($w) >= 3));

        return $pool->map(function (Product $p) use ($words) {
            $text = mb_strtolower($p->name.' '.$p->short_description.' '.strip_tags((string) $p->description));
            $score = 0;
            foreach ($words as $word) {
                $score += str_contains($text, $word) ? 1 : 0;
            }

            return [$p->id, $score];
        })->sortBy([[1, 'desc'], [0, 'desc']])->take($top)->pluck(0)->map(fn ($id) => (int) $id)->values()->all();
    }
}
