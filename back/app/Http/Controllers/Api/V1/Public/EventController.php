<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Public;

use App\Actions\Analytics\RecordPageEvent;
use App\Enums\AbTestStatus;
use App\Http\Controllers\Concerns\RespondsWithJson;
use App\Http\Controllers\Controller;
use App\Models\AbTest;
use App\Services\PublicSite;
use App\Tenancy\Tenancy;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/** Visit counters from public pages, and the A/B split table Next's proxy routes with. */
final class EventController extends Controller
{
    use RespondsWithJson;

    public function __construct(private readonly PublicSite $site) {}

    public function store(Request $request, RecordPageEvent $record): JsonResponse
    {
        $data = $request->validate([
            'host' => ['required', 'string', 'max:253'],
            'slug' => ['present', 'nullable', 'string', 'max:100'],
            'type' => ['required', Rule::in(RecordPageEvent::TYPES)],
            'utm_source' => ['nullable', 'string', 'max:100'],
            'referrer' => ['nullable', 'string', 'max:500'],
            'device' => ['nullable', Rule::in(['mobile', 'desktop'])],
            'ab' => ['nullable', 'integer', 'min:1'],
            'ip' => ['nullable', 'ip'],
        ]);
        $domain = $this->site->activeDomainOrFail($data['host']);

        Tenancy::runAs($domain->tenant_id, function () use ($data, $record): void {
            $page = $this->site->pageOrFail((string) ($data['slug'] ?? ''));
            $record->handle($page, [
                'type' => $data['type'],
                'utm_source' => $data['utm_source'] ?? null,
                'referrer' => $data['referrer'] ?? null,
                'device' => $data['device'] ?? null,
                'ab' => isset($data['ab']) ? (int) $data['ab'] : null,
            ]);
        });

        return $this->ok(['received' => true], [], 202);
    }

    /**
     * Entry links under test on a host: running tests split by split_a; a finished test whose
     * winner is B keeps sending the entry link to B.
     */
    public function abRoutes(Request $request): JsonResponse
    {
        $domain = $this->site->activeDomainOrFail((string) $request->query('host', ''));

        $routes = Tenancy::runAs($domain->tenant_id, fn () => AbTest::query()
            ->with(['pageA:id,slug,is_home,status', 'pageB:id,slug,status'])
            ->where(fn ($q) => $q->where('status', AbTestStatus::Running)->orWhere(fn ($w) => $w->where('status', AbTestStatus::Finished)->whereColumn('winner_page_id', 'page_b_id')))
            ->get()
            ->filter(fn (AbTest $test) => $test->pageA?->isPublished() && $test->pageB?->isPublished())
            ->map(fn (AbTest $test) => [
                'id' => $test->id,
                'entries' => array_values(array_unique(array_filter([$test->pageA->slug, $test->pageA->is_home ? '' : null], fn ($s) => $s !== null))),
                'a' => $test->pageA->slug,
                'b' => $test->pageB->slug,
                'split_a' => $test->status === AbTestStatus::Running ? $test->split_a : 0,
            ])
            ->values()
            ->all());

        return $this->ok($routes)->header('Cache-Control', 'no-store');
    }
}
