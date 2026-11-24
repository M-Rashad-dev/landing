<?php

declare(strict_types=1);

namespace App\Ai\Copilot\Resources;

use App\Ai\Copilot\Contracts\CopilotResource;
use App\Ai\Copilot\Contracts\Field;
use App\Ai\Copilot\CopilotContext;
use App\Enums\ExpenseKind;
use App\Http\Requests\Dashboard\ExpenseRequest;
use App\Models\Expense;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Foundation\Http\FormRequest;

/** The store's expenses of «الأرباح» (ad spend, salaries, rent…), counted in the net profit of their day. */
final class ExpensesResource extends CopilotResource
{
    public function key(): string
    {
        return 'expenses';
    }

    public function label(): string
    {
        return 'المصروفات';
    }

    public function summary(): string
    {
        return 'Store expenses outside the orders: day (Y-m-d), kind (ads per platform, salaries, rent, tools, other), amount in EGP, note. Ad spend per platform gives ROAS in the profit report.';
    }

    public function model(): string
    {
        return Expense::class;
    }

    public function query(CopilotContext $ctx): Builder
    {
        return Expense::query();
    }

    public function fields(): array
    {
        return [
            Field::text('spent_on')->label('اليوم')->sortable()->editable()->using(fn (Model $e) => $e instanceof Expense ? $e->spent_on->format('Y-m-d') : null)->rules(['date_format:Y-m-d']),
            Field::enum('kind', ExpenseKind::class)->label('النوع')->filterable()->editable(),
            Field::money('amount')->label('المبلغ')->sortable()->editable()->rules(['numeric', 'gt:0', 'max:9999999.99']),
            Field::text('note')->label('ملاحظة')->searchable()->editable()->nullable()->rules(['nullable', 'string', 'max:200']),
        ];
    }

    public function labelOf(Model $row): string
    {
        return $row instanceof Expense ? $row->kind->label().' '.$row->spent_on->format('Y-m-d') : parent::labelOf($row);
    }

    public function request(): ?string
    {
        return ExpenseRequest::class;
    }

    public function routeParameter(): string
    {
        return 'expense';
    }

    public function body(Model $row): array
    {
        /** @var Expense $row */
        return [
            'spent_on' => $row->spent_on->format('Y-m-d'),
            'kind' => $row->kind->value,
            'amount' => (string) $row->amount,
            'note' => $row->note,
        ];
    }

    public function persist(FormRequest $validated, ?Model $row): Model
    {
        /** @var ExpenseRequest $validated */
        if ($row instanceof Expense) {
            $row->fill($validated->expenseData())->save();

            return $row;
        }

        return Expense::query()->create($validated->expenseData() + ['created_by' => auth()->id()]);
    }

    public function remove(Model $row): void
    {
        $row->delete();
    }

    public function createFields(): array
    {
        return ['spent_on' => 'required, Y-m-d (Cairo), not in the future', 'kind' => 'required: '.implode(' / ', ExpenseKind::values()), 'amount' => 'required, > 0, EGP', 'note' => '≤ 200'];
    }

    public function url(?Model $row): ?string
    {
        return '/dashboard/profit';
    }
}
