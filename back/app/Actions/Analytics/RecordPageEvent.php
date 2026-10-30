<?php

declare(strict_types=1);

namespace App\Actions\Analytics;

use App\Enums\AbTestStatus;
use App\Models\AbTest;
use App\Models\LandingPage;
use App\Support\TrafficSource;
use Illuminate\Support\Facades\DB;

/** Adds one visit or form start to the page's counters for today (Cairo date). */
final class RecordPageEvent
{
    public const TYPES = ['view', 'form_start'];

    /** @param array{type: string, utm_source?: string|null, referrer?: string|null, device?: string|null, ab?: int|null} $event */
    public function handle(LandingPage $page, array $event): void
    {
        $column = $event['type'] === 'form_start' ? 'form_starts' : 'views';
        $source = TrafficSource::classify($event['utm_source'] ?? null, $event['referrer'] ?? null);
        $device = ($event['device'] ?? '') === 'desktop' ? 'desktop' : 'mobile';

        // Inside the page's tenant context (Tenancy::runAs by the caller).
        DB::statement(
            "insert into page_stats (tenant_id, landing_page_id, ab_test_id, date, source, device, {$column}) values (?, ?, ?, ?, ?, ?, 1)
             on duplicate key update {$column} = {$column} + 1",
            [$page->tenant_id, $page->id, $this->testId($page, $event['ab'] ?? null), now('Africa/Cairo')->toDateString(), $source, $device],
        );
    }

    /** The visitor's test id counts only while that test runs and includes this page. */
    public function testId(LandingPage $page, ?int $abTestId): int
    {
        if (! $abTestId) {
            return 0;
        }
        $test = AbTest::query()->whereKey($abTestId)->where('status', AbTestStatus::Running)->first();

        return $test !== null && $test->hasPage($page->id) ? $test->id : 0;
    }
}
