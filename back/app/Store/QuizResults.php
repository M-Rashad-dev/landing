<?php

declare(strict_types=1);

namespace App\Store;

use App\Models\Store;
use App\Models\StoreQuizResult;
use Illuminate\Support\Facades\DB;

/**
 * «اختبار البشرة» numbers: a visitor's result counted once per finished quiz (counts only, no
 * personal data), and the results of a quiz over the last days for the merchant and the copilot.
 */
final class QuizResults
{
    /**
     * A visitor finished the quiz of this section with this result (only a quiz of the published design counts);
     * `$ai` when the AI recommended it.
     */
    public function record(Store $store, string $sectionId, string $resultId, bool $ai = false): bool
    {
        $section = collect((array) ($store->design()?->published['sections'] ?? []))->first(fn ($s) => is_array($s) && ($s['id'] ?? null) === $sectionId && ($s['type'] ?? null) === 'skin_quiz');
        $known = $section !== null && in_array($resultId, array_column((array) ($section['props']['results'] ?? []), 'id'), true);
        if (! $known) {
            return false;
        }
        // One atomic upsert per finished quiz (same pattern as the store traffic counters).
        StoreQuizResult::query()->upsert(
            [['tenant_id' => $store->tenant_id, 'section_id' => $sectionId, 'result_id' => $resultId, 'date' => now('Africa/Cairo')->toDateString(), 'count' => 1, 'ai_count' => $ai ? 1 : 0]],
            ['tenant_id', 'section_id', 'result_id', 'date'],
            ['count' => DB::raw('count + 1'), 'ai_count' => DB::raw('ai_count + '.($ai ? 1 : 0))],
        );

        return true;
    }

    /**
     * The results of the store's quiz sections over the last days, named from the draft design.
     *
     * @param  list<array<string, mixed>>  $sections  the design's sections
     * @return list<array{section_id: string, title: string, total: int, ai: int, results: list<array{id: string, name: string, count: int, ai: int}>}>
     */
    public function summary(array $sections, int $days = 30): array
    {
        $counts = StoreQuizResult::query()->where('date', '>=', now('Africa/Cairo')->subDays($days - 1)->toDateString())
            ->selectRaw('section_id, result_id, sum(count) as total, sum(ai_count) as ai_total')->groupBy('section_id', 'result_id')->get()
            ->groupBy('section_id');

        $out = [];
        foreach ($sections as $section) {
            if (! is_array($section) || ($section['type'] ?? null) !== 'skin_quiz') {
                continue;
            }
            $rows = $counts->get((string) $section['id'], collect())->keyBy('result_id');
            $results = array_map(fn (array $r) => ['id' => (string) $r['id'], 'name' => (string) $r['name'], 'count' => (int) ($rows[$r['id']]->total ?? 0), 'ai' => (int) ($rows[$r['id']]->ai_total ?? 0)], (array) ($section['props']['results'] ?? []));
            $out[] = ['section_id' => (string) $section['id'], 'title' => (string) ($section['props']['title'] ?? ''), 'total' => array_sum(array_column($results, 'count')), 'ai' => array_sum(array_column($results, 'ai')), 'results' => $results];
        }

        return $out;
    }
}
