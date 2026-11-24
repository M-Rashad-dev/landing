<?php

declare(strict_types=1);

namespace App\Http\Requests\Dashboard;

use App\Enums\ExpenseKind;
use App\Http\Requests\ApiRequest;
use App\Support\Money;
use Carbon\CarbonImmutable;
use Illuminate\Validation\Rule;

/** A store expense of «الأرباح»: the day, what it was for, how much, a short note. */
final class ExpenseRequest extends ApiRequest
{
    protected function prepareForValidation(): void
    {
        if (is_string($this->input('note'))) {
            $note = trim(strip_tags($this->input('note')));
            $this->merge(['note' => $note === '' ? null : $note]);
        }
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'spent_on' => ['required', 'date_format:Y-m-d', 'before_or_equal:'.CarbonImmutable::now('Africa/Cairo')->addDay()->format('Y-m-d')],
            'kind' => ['required', Rule::in(ExpenseKind::values())],
            'amount' => ['required', 'numeric', 'decimal:0,2', 'gt:0', 'max:9999999.99'],
            'note' => ['nullable', 'string', 'max:200'],
        ];
    }

    /** @return array{spent_on: string, kind: string, amount: string, note: string|null} */
    public function expenseData(): array
    {
        return [
            'spent_on' => (string) $this->validated('spent_on'),
            'kind' => (string) $this->validated('kind'),
            'amount' => Money::toDecimal(Money::toCents((string) $this->validated('amount'))),
            'note' => $this->validated('note'),
        ];
    }
}
