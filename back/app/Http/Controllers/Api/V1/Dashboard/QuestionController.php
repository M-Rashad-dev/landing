<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Dashboard;

use App\Http\Controllers\Concerns\RespondsWithJson;
use App\Http\Controllers\Controller;
use App\Http\Requests\Dashboard\ProductQuestionRequest;
use App\Models\ProductQuestion;
use App\Models\Store;
use App\Rules\TenantExists;
use App\Store\Questions\ProductQuestions;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Validation\Rule;

/**
 * «أسئلة العملاء» (docs/plans/tekno/PLAN.md §3): what visitors asked on the products, the unanswered first. The
 * merchant answers and publishes (or hides, or deletes) them, and turns the questions on / off for the whole store.
 */
final class QuestionController extends Controller
{
    use RespondsWithJson;

    public function __construct(private readonly ProductQuestions $questions) {}

    public function index(Request $request): JsonResponse
    {
        $data = $request->validate([
            'status' => ['nullable', Rule::in(['all', ...ProductQuestions::STATUSES])],
            'product_id' => ['nullable', 'integer', TenantExists::table('products')],
            'q' => ['nullable', 'string', 'max:100'],
            'page' => ['nullable', 'integer', 'min:1', 'max:10000'],
        ]);

        $status = ($data['status'] ?? 'all') === 'all' ? null : (string) $data['status'];
        $page = $this->questions->listQuery($status, $data['q'] ?? null, isset($data['product_id']) ? (int) $data['product_id'] : null)
            ->paginate(20, ['*'], 'page', (int) ($data['page'] ?? 1));

        return $this->ok(
            $page->getCollection()->map(fn (ProductQuestion $q) => $this->questions->row($q))->values()->all(),
            [
                'current_page' => $page->currentPage(), 'last_page' => $page->lastPage(), 'per_page' => $page->perPage(), 'total' => $page->total(),
                'counts' => $this->questions->counts(),
                // The store's switch (no store yet = nothing to show questions on).
                'enabled' => (bool) (Store::query()->value('questions_enabled') ?? true),
            ],
        );
    }

    public function update(ProductQuestionRequest $request, ProductQuestion $question): JsonResponse
    {
        $this->questions->answer($question, $request->validated());

        return $this->ok($this->questions->row($question->load('product.media')));
    }

    public function destroy(ProductQuestion $question): Response
    {
        $this->questions->delete($question);

        return $this->noContent();
    }

    /** «استقبل أسئلة على صفحات المنتجات». */
    public function settings(Request $request): JsonResponse
    {
        $data = $request->validate(['enabled' => ['required', 'boolean']]);
        $store = Store::query()->firstOrFail();
        $this->questions->setEnabled($store, (bool) $data['enabled']);

        return $this->ok(['enabled' => $store->questions_enabled]);
    }
}
