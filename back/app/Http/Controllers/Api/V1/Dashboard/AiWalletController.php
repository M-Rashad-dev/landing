<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Dashboard;

use App\Ai\AiSettings;
use App\Ai\AiWallets;
use App\Enums\InvoiceStatus;
use App\Http\Controllers\Concerns\RespondsWithJson;
use App\Http\Controllers\Controller;
use App\Models\AiWalletEntry;
use App\Models\Invoice;
use App\Models\Tenant;
use App\Support\CairoTime;
use App\Support\Money;
use App\Tenancy\Tenancy;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * The store's AI balance (settings «رصيد الذكاء الاصطناعي»): what is left (free and paid), the
 * top-up packages and offers, this month's spending, a top-up waiting for review, and the moves.
 * Topping up itself goes through the billing checkout (type ai_credit).
 */
final class AiWalletController extends Controller
{
    use RespondsWithJson;

    public function __construct(private readonly AiWallets $wallets, private readonly AiSettings $settings) {}

    public function show(): JsonResponse
    {
        $tenant = Tenant::query()->findOrFail(Tenancy::id());
        $wallet = $this->wallets->wallet($tenant->id);
        $month = CarbonImmutable::now(CairoTime::ZONE)->startOfMonth()->utc();
        $spent = AiWalletEntry::query()->where('type', 'charge')->where('created_at', '>=', $month)
            ->selectRaw('feature, sum(amount) as total')->groupBy('feature')->pluck('total', 'feature');
        $pending = Invoice::query()->where('type', 'ai_credit')->whereIn('status', [InvoiceStatus::Open->value, InvoiceStatus::PendingReview->value])->latest('id')->first();

        return $this->ok([
            'balance' => Money::toFloat($wallet->freeCents() + $wallet->paidCents()),
            'free' => Money::toFloat($wallet->freeCents()),
            'paid' => Money::toFloat($wallet->paidCents()),
            'spendable' => Money::toFloat($this->wallets->spendableCents($tenant)),
            // Topping up and the paid pot need a plan with the AI; the free pot works on every plan.
            'paid_allowed' => $this->wallets->paidAllowed($tenant),
            'packages' => $this->settings->topupPackages(),
            'min' => $this->settings->topupMin(),
            'offers' => $this->settings->topupOffers(),
            'low_balance' => $this->settings->lowBalance(),
            'month' => [
                'spent' => Money::toFloat(-Money::toCents((string) $spent->sum())),
                'by_feature' => $spent->map(fn ($total, $feature) => ['feature' => (string) $feature, 'spent' => Money::toFloat(-Money::toCents((string) $total))])->values(),
            ],
            'pending' => $pending === null ? null : ['id' => $pending->id, 'number' => $pending->number, 'status' => $pending->status->value, 'total' => Money::toFloat($pending->totalCents())],
        ]);
    }

    public function entries(Request $request): JsonResponse
    {
        $data = $request->validate(['type' => ['nullable', 'string', 'in:'.implode(',', AiWalletEntry::TYPES)], 'page' => ['nullable', 'integer', 'min:1']]);
        $page = AiWalletEntry::query()
            ->when(($data['type'] ?? null) !== null, fn ($q) => $q->where('type', $data['type']))
            ->orderByDesc('id')->paginate(30);

        return $this->ok(
            collect($page->items())->map(fn (AiWalletEntry $e) => [
                'id' => $e->id,
                'type' => $e->type,
                'amount' => Money::toFloat(Money::toCents((string) $e->amount)),
                'balance_after' => Money::toFloat(Money::toCents((string) $e->balance_after)),
                'feature' => $e->feature,
                'description' => $e->description,
                'created_at' => $e->created_at->toIso8601ZuluString(),
            ])->all(),
            ['current_page' => $page->currentPage(), 'last_page' => $page->lastPage(), 'per_page' => $page->perPage(), 'total' => $page->total()],
        );
    }
}
