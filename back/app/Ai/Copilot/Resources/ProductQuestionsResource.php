<?php

declare(strict_types=1);

namespace App\Ai\Copilot\Resources;

use App\Ai\Copilot\Contracts\CopilotResource;
use App\Ai\Copilot\Contracts\Field;
use App\Ai\Copilot\CopilotContext;
use App\Http\Requests\Dashboard\ProductQuestionRequest;
use App\Models\ProductQuestion;
use App\Store\Questions\ProductQuestions;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Str;

/**
 * «أسئلة العملاء» (docs/plans/tekno/PLAN.md §3): what visitors asked on the products. The copilot reads them and writes
 * answers / publishes them through the dashboard's own request and action. The asker's phone never reaches it.
 */
final class ProductQuestionsResource extends CopilotResource
{
    public function key(): string
    {
        return 'product_questions';
    }

    public function label(): string
    {
        return 'أسئلة العملاء';
    }

    public function summary(): string
    {
        return 'Questions visitors asked on product pages: product, question, the store\'s answer, is_published (shown on the product page; only an answered question can be published), status (unanswered / published / hidden = answered but not shown), dates. Answer in the store\'s voice, short Egyptian Arabic, only with facts from the product\'s own data (read it from products); leave it unanswered when the data doesn\'t say. Emptying the answer takes the question back to unanswered.';
    }

    public function available(CopilotContext $ctx): bool
    {
        return $ctx->hasStore();
    }

    public function model(): string
    {
        return ProductQuestion::class;
    }

    public function namedFilters(): array
    {
        return [
            'status' => ['type' => 'string', 'enum' => ProductQuestions::STATUSES, 'description' => 'unanswered, published or hidden (answered, not shown).'],
        ];
    }

    public function base(array $named, CopilotContext $ctx): Builder
    {
        return app(ProductQuestions::class)->listQuery(self::pick($named, 'status', ProductQuestions::STATUSES));
    }

    public function fields(): array
    {
        return [
            Field::text('product')->label('المنتج')->using(fn (Model $q) => $q instanceof ProductQuestion ? $q->product?->name : null),
            Field::int('product_id')->label('رقم المنتج')->filterable()->notInTable(),
            // The asker's name as the product page shows it («سارة م.»).
            Field::text('asker')->label('السائل')->using(fn (Model $q) => $q instanceof ProductQuestion ? $q->toPublic()['name'] : null),
            Field::textarea('question')->label('السؤال')->searchable(),
            Field::textarea('answer')->label('الرد')->searchable()->editable()->nullable(),
            Field::bool('is_published')->label('منشور')->filterable()->editable(),
            Field::enum('status', ProductQuestions::STATUSES)->label('الحالة')
                ->labels(['unanswered' => 'مستني رد', 'published' => 'منشور', 'hidden' => 'مخفي'])
                ->using(fn (Model $q) => $q instanceof ProductQuestion ? $q->status() : null),
            Field::date('answered_at')->label('اتردّ عليه')->filterable()->sortable(),
            Field::date('created_at')->label('اتسأل')->filterable()->sortable(),
        ];
    }

    public function with(): array
    {
        return ['product'];
    }

    public function labelOf(Model $row): string
    {
        return $row instanceof ProductQuestion ? Str::limit($row->question, 120) : '#'.$row->getKey();
    }

    public function request(): ?string
    {
        return ProductQuestionRequest::class;
    }

    public function routeParameter(): string
    {
        return 'question';
    }

    public function body(Model $row): array
    {
        return ['answer' => $row->getAttribute('answer'), 'is_published' => (bool) $row->getAttribute('is_published')];
    }

    public function validateRow(array $after, Model $row): ?string
    {
        $answer = array_key_exists('answer', $after) ? $after['answer'] : $row->getAttribute('answer');
        $published = array_key_exists('is_published', $after) ? (bool) $after['is_published'] : (bool) $row->getAttribute('is_published');

        return $published && trim((string) $answer) === '' ? (string) __('questions.publish_needs_answer') : null;
    }

    public function persist(FormRequest $validated, ?Model $row): Model
    {
        /** @var ProductQuestion $row */
        return app(ProductQuestions::class)->answer($row, $validated->validated());
    }

    /** The question's page refreshes itself (ProductQuestions::answer); nothing else to purge. */
    public function afterBulk(CopilotContext $ctx): void {}

    public function url(?Model $row): ?string
    {
        return '/dashboard/questions';
    }
}
