<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Admin;

use App\Actions\Admin\ManageTenant;
use App\Ai\AiWallets;
use App\Http\Controllers\Concerns\RespondsWithJson;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\AiWalletAdjustRequest;
use App\Models\AiWalletEntry;
use App\Models\Tenant;
use App\Support\Money;
use App\Tenancy\Tenancy;
use Illuminate\Http\JsonResponse;

/**
 * A store's AI balance in the admin (store page): what it has, its last moves, and the owner's
 * gift (free pot) or deduction, written in the audit log.
 */
final class AiWalletController extends Controller
{
    use RespondsWithJson;

    public function __construct(private readonly AiWallets $wallets) {}

    public function show(int $tenant): JsonResponse
    {
        return $this->ok($this->view(Tenant::query()->findOrFail($tenant)));
    }

    public function adjust(AiWalletAdjustRequest $request, int $tenant, ManageTenant $audit): JsonResponse
    {
        $store = Tenant::query()->findOrFail($tenant);
        $data = $request->validated();
        $cents = Money::toCents((string) $data['amount']);
        $reason = trim(strip_tags((string) $data['reason']));
        $admin = (int) $request->user()?->getAuthIdentifier();

        if ($data['action'] === 'gift') {
            $this->wallets->credit($store, $cents, 'gift', $reason, adminId: $admin);
        } else {
            $this->wallets->deduct($store, $cents, $reason, $admin);
        }
        $audit->audit('ai.wallet.'.$data['action'], $store, ['amount' => Money::toDecimal($cents), 'reason' => $reason]);

        return $this->ok($this->view($store));
    }

    /** @return array<string, mixed> */
    private function view(Tenant $store): array
    {
        $wallet = $this->wallets->wallet($store->id);
        $entries = Tenancy::runAs($store->id, fn () => AiWalletEntry::query()->orderByDesc('id')->limit(20)->get());

        return [
            'balance' => Money::toFloat($wallet->freeCents() + $wallet->paidCents()),
            'free' => Money::toFloat($wallet->freeCents()),
            'paid' => Money::toFloat($wallet->paidCents()),
            'paid_allowed' => $this->wallets->paidAllowed($store),
            'entries' => $entries->map(fn (AiWalletEntry $entry) => [
                'id' => $entry->id,
                'type' => $entry->type,
                'amount' => Money::toFloat(Money::toCents((string) $entry->amount)),
                'balance_after' => Money::toFloat(Money::toCents((string) $entry->balance_after)),
                'description' => $entry->description,
                'created_at' => $entry->created_at->toIso8601ZuluString(),
            ])->all(),
        ];
    }
}
