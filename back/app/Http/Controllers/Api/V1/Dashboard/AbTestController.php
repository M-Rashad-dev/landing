<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Dashboard;

use App\Enums\AbTestStatus;
use App\Exceptions\ApiException;
use App\Http\Controllers\Concerns\RespondsWithJson;
use App\Http\Controllers\Controller;
use App\Jobs\RevalidateTenantHosts;
use App\Models\AbTest;
use App\Models\LandingPage;
use App\Rules\TenantExists;
use App\Services\PageAnalytics;
use App\Tenancy\Tenancy;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/** A/B tests between two whole published pages of the same product. */
final class AbTestController extends Controller
{
    use RespondsWithJson;

    public function __construct(private readonly PageAnalytics $analytics) {}

    public function index(): JsonResponse
    {
        $tests = AbTest::query()->with(['pageA:id,title,slug,status,product_id', 'pageB:id,title,slug,status'])->orderByRaw("status = 'running' desc")->orderByDesc('id')->get();

        return $this->ok($tests->map(fn (AbTest $test) => $this->row($test))->all());
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:80'],
            'page_a_id' => ['required', 'integer', TenantExists::table('landing_pages')],
            'page_b_id' => ['required', 'integer', 'different:page_a_id', TenantExists::table('landing_pages')],
            'split_a' => ['required', 'integer', 'between:10,90'],
        ]);

        $a = LandingPage::query()->findOrFail($data['page_a_id']);
        $b = LandingPage::query()->findOrFail($data['page_b_id']);
        foreach (['page_a_id' => $a, 'page_b_id' => $b] as $field => $page) {
            if (! $page->isPublished()) {
                throw ValidationException::withMessages([$field => [__('analytics.page_not_published')]]);
            }
        }
        if ($a->product_id === null || $a->product_id !== $b->product_id) {
            throw ValidationException::withMessages(['page_b_id' => [__('analytics.same_product')]]);
        }
        $busy = AbTest::query()->where('status', AbTestStatus::Running)
            ->where(fn ($q) => $q->whereIn('page_a_id', [$a->id, $b->id])->orWhereIn('page_b_id', [$a->id, $b->id]))
            ->exists();
        if ($busy) {
            throw ValidationException::withMessages(['page_a_id' => [__('analytics.page_in_test')]]);
        }

        // A finished test that still routes A's link to B is replaced by the new one.
        AbTest::query()->where('page_a_id', $a->id)->where('status', AbTestStatus::Finished)->whereColumn('winner_page_id', 'page_b_id')->update(['winner_page_id' => null]);

        $test = AbTest::query()->create([
            'name' => trim(strip_tags($data['name'])),
            'page_a_id' => $a->id,
            'page_b_id' => $b->id,
            'split_a' => (int) $data['split_a'],
            'status' => AbTestStatus::Running,
            'started_at' => now(),
        ]);
        RevalidateTenantHosts::dispatch((int) Tenancy::id())->afterCommit();

        return $this->created($this->row($test->load(['pageA', 'pageB'])));
    }

    /** Stop the split; choosing B keeps sending A's link to B. */
    public function finish(Request $request, AbTest $abTest): JsonResponse
    {
        $data = $request->validate([
            'winner_page_id' => ['nullable', 'integer', Rule::in([$abTest->page_a_id, $abTest->page_b_id])],
        ]);
        if ($abTest->status !== AbTestStatus::Running) {
            throw new ApiException(422, 'test_finished', __('analytics.already_finished'));
        }

        $abTest->update(['status' => AbTestStatus::Finished, 'winner_page_id' => $data['winner_page_id'] ?? null, 'ended_at' => now()]);

        return $this->ok($this->row($abTest->load(['pageA', 'pageB'])));
    }

    public function destroy(AbTest $abTest): Response
    {
        $abTest->delete();

        return $this->noContent();
    }

    /** @return array<string, mixed> */
    private function row(AbTest $test): array
    {
        $page = fn (?LandingPage $p) => $p ? ['id' => $p->id, 'title' => $p->title, 'slug' => $p->slug, 'published' => $p->isPublished()] : null;

        return [
            'id' => $test->id,
            'name' => $test->name,
            'status' => $test->status->value,
            'split_a' => $test->split_a,
            'page_a' => $page($test->pageA),
            'page_b' => $page($test->pageB),
            'winner_page_id' => $test->winner_page_id,
            'started_at' => $test->started_at->toIso8601ZuluString(),
            'ended_at' => $test->ended_at?->toIso8601ZuluString(),
            'results' => $this->analytics->abTest($test),
        ];
    }
}
