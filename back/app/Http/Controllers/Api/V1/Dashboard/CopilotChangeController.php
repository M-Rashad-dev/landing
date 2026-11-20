<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Dashboard;

use App\Ai\Copilot\Changes\ChangeSetApplier;
use App\Ai\Copilot\Changes\ChangeSetPresenter;
use App\Ai\Copilot\CopilotContext;
use App\Http\Controllers\Controller;
use App\Imports\Spreadsheet\XlsxWriter;
use App\Models\CopilotChangeSet;
use App\Models\Tenant;
use App\Models\User;
use App\Tenancy\Tenancy;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

/**
 * The copilot's changes under `/api/v1/dashboard/ai/copilot/change-sets` (docs/plans/ai-copilot.md §3.14): the cards,
 * their records page by page, the full preview as Excel, and the merchant's buttons (نفّذ / ارفض / تراجع).
 */
final class CopilotChangeController extends Controller
{
    private const STATUSES = ['pending', 'applied', 'skipped_stale', 'skipped_invalid', 'failed', 'reverted', 'kept'];

    public function __construct(private readonly ChangeSetPresenter $presenter, private readonly ChangeSetApplier $applier) {}

    /** The history page: newest first. */
    public function index(Request $request): JsonResponse
    {
        $data = $request->validate(['status' => ['nullable', Rule::in(['proposed', 'applying', 'applied', 'rejected', 'expired', 'failed', 'reverted'])]]);
        $page = CopilotChangeSet::query()
            ->when(isset($data['status']), fn ($q) => $q->where('status', $data['status']))
            ->latest('id')->paginate(20);
        $ctx = $this->context($request);

        return $this->ok(
            $page->getCollection()->map(fn (CopilotChangeSet $s) => $this->presenter->set($s, $ctx))->values()->all(),
            ['current_page' => $page->currentPage(), 'last_page' => $page->lastPage(), 'per_page' => $page->perPage(), 'total' => $page->total()],
        );
    }

    public function show(Request $request, CopilotChangeSet $changeSet): JsonResponse
    {
        return $this->ok($this->presenter->set($changeSet, $this->context($request)));
    }

    public function items(Request $request, CopilotChangeSet $changeSet): JsonResponse
    {
        $data = $request->validate(['status' => ['nullable', Rule::in(self::STATUSES)], 'page' => ['nullable', 'integer', 'min:1']]);

        return $this->ok($this->presenter->items($changeSet, $this->context($request), $data['status'] ?? null, (int) ($data['page'] ?? 1)));
    }

    /** The whole preview as Excel (every record, before / after, status). */
    public function itemsFile(Request $request, CopilotChangeSet $changeSet, XlsxWriter $writer): BinaryFileResponse
    {
        $ctx = $this->context($request);
        $columns = $this->presenter->items($changeSet, $ctx, null, 1, 1)['columns'];
        $headers = ['الاسم'];
        foreach ($columns as $c) {
            $headers[] = $c['label'].' (قبل)';
            $headers[] = $c['label'].' (بعد)';
        }
        $headers = [...$headers, 'الحالة', 'ملاحظة'];
        $statusLabels = (array) __('ai.copilot.item_status');
        $rows = (function () use ($changeSet, $ctx, $columns, $statusLabels) {
            $page = 1;
            do {
                $chunk = $this->presenter->items($changeSet, $ctx, null, $page, 500);
                foreach ($chunk['items'] as $item) {
                    $row = [$item['label']];
                    foreach ($columns as $c) {
                        $row[] = $item['before'][$c['key']] ?? '';
                        $row[] = $item['after'][$c['key']] ?? '';
                    }
                    yield [...$row, $statusLabels[$item['status']] ?? $item['status'], $item['note'] ?? ''];
                }
                $page++;
            } while ($page <= $chunk['last_page']);
        })();
        $path = tempnam(sys_get_temp_dir(), 'copilot-change-').'.xlsx';
        $writer->write($path, 'المعاينة', $headers, $rows);

        return response()->download($path, 'معاينة-'.$changeSet->id.'.xlsx')->deleteFileAfterSend();
    }

    /** «نفّذ» / «انشر» / «سيبهم مسودة»: applied in the background (202). */
    public function accept(Request $request, CopilotChangeSet $changeSet): JsonResponse
    {
        $set = $this->applier->accept($changeSet, $this->user($request));

        return response()->json(['data' => $this->presenter->set($set, $this->context($request))], 202);
    }

    /** «ارفض» / «امسح». */
    public function reject(Request $request, CopilotChangeSet $changeSet): JsonResponse
    {
        return $this->ok($this->presenter->set($this->applier->reject($changeSet, $this->user($request)), $this->context($request)));
    }

    /** «تراجع»: a new change putting the old values back, applied in the background (202). */
    public function revert(Request $request, CopilotChangeSet $changeSet): JsonResponse
    {
        $revert = $this->applier->revert($changeSet, $this->user($request));

        return response()->json(['data' => $this->presenter->set($revert, $this->context($request))], 202);
    }

    private function user(Request $request): User
    {
        /** @var User $user */
        $user = $request->user();

        return $user;
    }

    private function context(Request $request): CopilotContext
    {
        return new CopilotContext(Tenant::query()->findOrFail(Tenancy::id()), $this->user($request));
    }
}
