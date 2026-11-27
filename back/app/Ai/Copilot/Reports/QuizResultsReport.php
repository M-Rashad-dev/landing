<?php

declare(strict_types=1);

namespace App\Ai\Copilot\Reports;

use App\Ai\Copilot\Contracts\CopilotReport;
use App\Ai\Copilot\CopilotContext;
use App\Ai\Copilot\Support\ReportResult;
use App\Store\QuizResults;
use App\Store\StoreSetup;
use App\Themes\Store\StoreDesigner;

/** «اختبار البشرة» of the store's design: how many visitors got each result over the last days. */
final class QuizResultsReport extends CopilotReport
{
    public function __construct(private readonly QuizResults $results, private readonly StoreSetup $setup, private readonly StoreDesigner $designer) {}

    public function key(): string
    {
        return 'quiz_results';
    }

    public function label(): string
    {
        return 'نتايج اختبار البشرة';
    }

    public function summary(): string
    {
        return 'The store home\'s «اختبار البشرة» (skin quiz) sections: for each, how many visitors finished it and how many got each result (skin type) over the last N days. Counts only, nothing about the visitors. Empty when the store has no quiz section.';
    }

    public function available(CopilotContext $ctx): bool
    {
        return $this->setup->current() !== null;
    }

    public function params(): array
    {
        return ['type' => 'object', 'properties' => ['days' => ['type' => 'integer', 'minimum' => 1, 'maximum' => 90, 'description' => 'Days back, default 30.']]];
    }

    public function run(array $params, CopilotContext $ctx): ReportResult
    {
        $days = max(1, min(90, (int) ($params['days'] ?? 30)));
        $store = $this->setup->current();
        $quizzes = $store === null ? [] : $this->results->summary((array) ($this->designer->for($store)->draft['sections'] ?? []), $days);
        $rows = [];
        foreach ($quizzes as $quiz) {
            foreach ($quiz['results'] as $result) {
                $rows[] = ['quiz' => $quiz['title'], 'result' => $result['name'], 'count' => $result['count'], 'ai' => $result['ai']];
            }
        }

        return new ReportResult(
            summary: ['period_days' => $days, 'quizzes' => $quizzes],
            title: 'نتايج اختبار البشرة',
            columns: [['key' => 'quiz', 'label' => 'الاختبار', 'kind' => 'text'], ['key' => 'result', 'label' => 'النتيجة', 'kind' => 'text'], ['key' => 'count', 'label' => 'عدد العميلات', 'kind' => 'int'], ['key' => 'ai', 'label' => 'منهم بترشيح الذكاء الاصطناعي', 'kind' => 'int']],
            rows: $rows,
        );
    }
}
