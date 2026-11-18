<?php

declare(strict_types=1);

namespace App\Ai;

use App\Jobs\EmbedKnowledge;
use App\Models\AiArticle;
use App\Models\AiArticleChunk;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

/**
 * The support assistant's knowledge base: articles are cut into pieces (title + a paragraph or
 * a few), each piece gets a vector (embedding model of config/ai.php), and a question finds the
 * pieces nearest to it (cosine likeness, searched here: a few hundred pieces need no vector database).
 */
final class Knowledge
{
    private const VECTORS_KEY = 'ai:knowledge:vectors';

    public function __construct(private readonly Ai $ai) {}

    /** Cuts the article again and queues its vectors (after every save). */
    public function refresh(AiArticle $article): void
    {
        DB::transaction(function () use ($article): void {
            $article->chunks()->delete();
            foreach (self::cut($article) as $i => $text) {
                AiArticleChunk::query()->create(['ai_article_id' => $article->id, 'position' => $i, 'text' => $text]);
            }
            $article->forceFill(['embedded_at' => null, 'embed_error' => null])->save();
        });
        self::forget();
        EmbedKnowledge::dispatch()->afterCommit();
    }

    /**
     * The article's pieces: paragraphs joined up to the size limit, each led by the title so it
     * stands alone.
     *
     * @return list<string>
     */
    public static function cut(AiArticle $article): array
    {
        $limit = (int) config('ai.knowledge.chunk_chars', 900);
        $paragraphs = array_values(array_filter(array_map('trim', preg_split('/\n\s*\n/u', str_replace("\r", '', $article->body)) ?: []), fn ($p) => $p !== ''));
        $pieces = [];
        $current = '';
        foreach ($paragraphs as $paragraph) {
            if ($current !== '' && mb_strlen($current) + mb_strlen($paragraph) + 2 > $limit) {
                $pieces[] = $current;
                $current = '';
            }
            $current = $current === '' ? $paragraph : $current."\n\n".$paragraph;
        }
        if ($current !== '') {
            $pieces[] = $current;
        }

        return array_map(fn (string $p) => $article->title."\n".$p, $pieces ?: ['']);
    }

    /**
     * Gives a vector to every piece without one (or made by another model). Leaves them waiting
     * while the assistant is off or the AI unavailable; returns how many got one.
     */
    public function embedPending(): int
    {
        $model = Ai::model('embedding');
        $done = 0;
        $pending = AiArticleChunk::query()->where(fn ($q) => $q->whereNull('embedding')->orWhere('model', '!=', $model)->orWhereNull('model'))
            ->orderBy('id')->get();

        foreach ($pending->chunk(max(1, (int) config('ai.knowledge.batch', 10))) as $batch) {
            try {
                $result = $this->ai->embed('support', 'embedding', $batch->pluck('text')->all());
            } catch (AiUnavailable $e) {
                if ($e->reason === AiUnavailable::FAILED) {
                    AiArticle::query()->whereIn('id', $batch->pluck('ai_article_id')->unique())->update(['embed_error' => __('ai.knowledge.embed_failed')]);
                }

                break;
            }
            foreach ($batch->values() as $i => $chunk) {
                $chunk->forceFill(['embedding' => $result->vectors[$i] ?? null, 'model' => $result->model])->save();
            }
            $done += $batch->count();
        }

        // An article is ready once all its pieces have a vector of the current model.
        AiArticle::query()->whereNull('embedded_at')
            ->whereDoesntHave('chunks', fn ($q) => $q->where(fn ($w) => $w->whereNull('embedding')->orWhere('model', '!=', $model)->orWhereNull('model')))
            ->update(['embedded_at' => now(), 'embed_error' => null]);
        self::forget();

        return $done;
    }

    /**
     * The pieces nearest to a question (active articles only), best first.
     *
     * @return list<array{chunk_id: int, article_id: int, title: string, text: string, score: float}>
     *
     * @throws AiUnavailable
     */
    public function search(string $question, ?int $tenantId = null): array
    {
        $vectors = $this->vectors();
        if ($vectors === []) {
            return [];
        }
        $query = $this->ai->embed('support', 'embedding', [$question], $tenantId)->vectors[0] ?? [];
        $min = (float) config('ai.knowledge.min_score', 0.35);

        $scored = [];
        foreach ($vectors as $row) {
            $score = self::cosine($query, $row['vector']);
            if ($score >= $min) {
                $scored[] = ['chunk_id' => $row['chunk_id'], 'article_id' => $row['article_id'], 'title' => $row['title'], 'text' => $row['text'], 'score' => round($score, 4)];
            }
        }
        usort($scored, fn ($a, $b) => $b['score'] <=> $a['score']);

        return array_slice($scored, 0, (int) config('ai.knowledge.top', 5));
    }

    /** @param list<float> $a @param list<float> $b */
    public static function cosine(array $a, array $b): float
    {
        $dot = $na = $nb = 0.0;
        $n = min(count($a), count($b));
        for ($i = 0; $i < $n; $i++) {
            $dot += $a[$i] * $b[$i];
            $na += $a[$i] ** 2;
            $nb += $b[$i] ** 2;
        }

        return $na > 0 && $nb > 0 ? $dot / (sqrt($na) * sqrt($nb)) : 0.0;
    }

    /** @return list<array{chunk_id: int, article_id: int, title: string, text: string, vector: list<float>}> */
    private function vectors(): array
    {
        $model = Ai::model('embedding');

        // Big vectors (4096 numbers a piece) don't fit the database cache: a file (config ai.knowledge.cache_store).
        return Cache::store((string) config('ai.knowledge.cache_store', 'file'))->rememberForever(self::VECTORS_KEY, fn () => AiArticleChunk::query()
            ->join('ai_articles', 'ai_articles.id', '=', 'ai_article_chunks.ai_article_id')
            ->where('ai_articles.is_active', true)->where('ai_article_chunks.model', $model)->whereNotNull('ai_article_chunks.embedding')
            ->get(['ai_article_chunks.id', 'ai_article_chunks.ai_article_id', 'ai_article_chunks.text', 'ai_article_chunks.embedding', 'ai_articles.title'])
            ->map(fn (AiArticleChunk $c) => ['chunk_id' => $c->id, 'article_id' => $c->ai_article_id, 'title' => (string) $c->getAttribute('title'), 'text' => $c->text, 'vector' => array_map('floatval', (array) $c->embedding)])
            ->all());
    }

    public static function forget(): void
    {
        Cache::store((string) config('ai.knowledge.cache_store', 'file'))->forget(self::VECTORS_KEY);
    }
}
