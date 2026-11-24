<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Dashboard;

use App\Analytics\ProfitReport;
use App\Enums\ExpenseKind;
use App\Http\Controllers\Concerns\RespondsWithJson;
use App\Http\Controllers\Controller;
use App\Http\Requests\Dashboard\ExpenseRequest;
use App\Models\Expense;
use App\Models\ProfitSetting;
use App\Support\Money;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Validation\Rule;

/**
 * «الأرباح» (docs/plans/merchant-essentials.md, stage 3): the profit report, the store's expenses (ads, salaries,
 * rent…) and the packaging cost each new order carries.
 */
final class ProfitController extends Controller
{
    use RespondsWithJson;

    private const TZ = 'Africa/Cairo';

    public function report(Request $request, ProfitReport $report): JsonResponse
    {
        [$from, $to] = $this->period($request);

        return $this->ok($report->report($from, $to, self::TZ));
    }

    public function expenses(Request $request): JsonResponse
    {
        [$from, $to] = $this->period($request);
        $data = $request->validate(['kind' => ['nullable', Rule::in(ExpenseKind::values())]]);
        $rows = Expense::query()
            ->where('spent_on', '>=', $from->format('Y-m-d'))->where('spent_on', '<=', $to->format('Y-m-d'))
            ->when(isset($data['kind']), fn ($q) => $q->where('kind', $data['kind']))
            ->orderByDesc('spent_on')->orderByDesc('id')->paginate($this->perPage($request));

        return $this->ok(
            collect($rows->items())->map(fn (Expense $e) => $this->view($e))->all(),
            ['current_page' => $rows->currentPage(), 'last_page' => $rows->lastPage(), 'per_page' => $rows->perPage(), 'total' => $rows->total()],
        );
    }

    public function storeExpense(ExpenseRequest $request): JsonResponse
    {
        $expense = Expense::query()->create($request->expenseData() + ['created_by' => $request->user()?->id]);

        return $this->created($this->view($expense));
    }

    public function updateExpense(ExpenseRequest $request, Expense $expense): JsonResponse
    {
        $expense->fill($request->expenseData())->save();

        return $this->ok($this->view($expense));
    }

    public function destroyExpense(Expense $expense): Response
    {
        $expense->delete();

        return $this->noContent();
    }

    public function settings(): JsonResponse
    {
        return $this->ok($this->settingsView());
    }

    public function updateSettings(Request $request): JsonResponse
    {
        $data = $request->validate(['packaging_cost' => ['required', 'numeric', 'decimal:0,2', 'min:0', 'max:100000']]);
        ProfitSetting::current()->fill(['packaging_cost' => Money::toDecimal(Money::toCents((string) $data['packaging_cost']))])->save();

        return $this->ok($this->settingsView());
    }

    /** @return array{CarbonImmutable, CarbonImmutable} Cairo days, the last 30 by default, a year at most */
    private function period(Request $request): array
    {
        $data = $request->validate([
            'from' => ['nullable', 'date_format:Y-m-d'],
            'to' => ['nullable', 'date_format:Y-m-d', 'after_or_equal:from'],
        ]);
        $to = isset($data['to']) ? CarbonImmutable::parse($data['to'], self::TZ) : CarbonImmutable::now(self::TZ)->startOfDay();
        $from = isset($data['from']) ? CarbonImmutable::parse($data['from'], self::TZ) : $to->subDays(29);
        if ($from->diffInDays($to) > 366) {
            $from = $to->subDays(366);
        }

        return [$from, $to];
    }

    /** @return array<string, mixed> */
    private function view(Expense $e): array
    {
        return [
            'id' => $e->id,
            'spent_on' => $e->spent_on->format('Y-m-d'),
            'kind' => $e->kind->value,
            'kind_label' => $e->kind->label(),
            'amount' => Money::toFloat(Money::toCents((string) $e->amount)),
            'note' => $e->note,
        ];
    }

    /** @return array<string, mixed> */
    private function settingsView(): array
    {
        return [
            'packaging_cost' => Money::toFloat(Money::toCents((string) ProfitSetting::current()->packaging_cost)),
            'kinds' => array_map(fn (ExpenseKind $k) => ['value' => $k->value, 'label' => $k->label(), 'is_ads' => $k->isAds()], ExpenseKind::cases()),
        ];
    }
}
