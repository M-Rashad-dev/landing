<?php

declare(strict_types=1);

namespace App\Ai;

use App\Billing\Entitlements;
use App\Billing\PlanCatalog;
use App\Enums\NotificationEvent;
use App\Enums\PlanFeature;
use App\Exceptions\ApiException;
use App\Models\AiUsage;
use App\Models\AiWallet;
use App\Models\AiWalletEntry;
use App\Models\Tenant;
use App\Notifications\Notice;
use App\Notifications\NotificationCenter;
use App\Support\Money;
use App\Tenancy\Tenancy;
use Illuminate\Support\Facades\DB;

/**
 * The merchants' AI balance, the only place it moves. Two pots: «free» (welcome credit, the owner's
 * gifts: any plan) and «paid» (top-ups and their offers: plans with the AI feature only). A charge
 * is the real cost of an AiUsage × the owner's dollar rate × (1 + margin), rounded up to the
 * piaster, taken from «free» first, once per usage. A call already made is charged in full even
 * if that goes a little below zero; the next one then waits for a top-up.
 */
final class AiWallets
{
    public function __construct(
        private readonly AiSettings $settings,
        private readonly Entitlements $entitlements,
        private readonly PlanCatalog $catalog,
        private readonly NotificationCenter $center,
    ) {}

    /** The store's wallet (made on first use). Inside the store's tenant. */
    public function wallet(int $tenantId): AiWallet
    {
        return Tenancy::runAs($tenantId, fn (): AiWallet => AiWallet::query()->firstOrCreate([]));
    }

    /** Whether the store's plan may top up and spend the paid pot. */
    public function paidAllowed(Tenant $tenant): bool
    {
        return $this->entitlements->for($tenant)->allows(PlanFeature::Ai);
    }

    /** What the store can spend now, in piasters. */
    public function spendableCents(Tenant $tenant): int
    {
        $wallet = $this->wallet($tenant->id);

        return max(0, $wallet->freeCents()) + ($this->paidAllowed($tenant) ? max(0, $wallet->paidCents()) : 0);
    }

    /** USD → piasters charged (null while the owner hasn't set the dollar rate). */
    public function priceCents(float $usd): ?int
    {
        $rate = $this->settings->usdRate();
        if ($rate === null) {
            return null;
        }

        return (int) ceil(round($usd * $rate * (1 + $this->settings->marginPercent() / 100) * 100, 6));
    }

    /**
     * Refuses a paid AI action the store can't afford (estimate in USD).
     *
     * @throws ApiException
     */
    public function ensureCanSpend(Tenant $tenant, float $estimateUsd): void
    {
        $cents = $this->priceCents($estimateUsd);
        if ($cents === null) {
            throw new ApiException(422, 'ai_unavailable', __('ai.wallet.unavailable'));
        }
        $wallet = $this->wallet($tenant->id);
        if ($this->spendableCents($tenant) >= max(1, $cents)) {
            return;
        }
        // Nothing free left and a plan without the AI: the plan is the reason, not the balance.
        if ($wallet->freeCents() <= 0 && ! $this->paidAllowed($tenant)) {
            throw ApiException::planFeatureLocked(PlanFeature::Ai, $this->catalog->cheapestWithFeature(PlanFeature::Ai));
        }

        throw new ApiException(422, 'ai_balance_low', __('ai.wallet.low'));
    }

    /** Charges a call (once: a second call for the same usage returns the first entry). */
    public function charge(Tenant $tenant, AiUsage $usage, string $feature, string $description): ?AiWalletEntry
    {
        $cents = $this->priceCents((float) $usage->cost_usd);
        if ($cents === null || $cents <= 0) {
            return null;
        }
        $paidAllowed = $this->paidAllowed($tenant);

        $entry = Tenancy::runAs($tenant->id, fn (): AiWalletEntry => DB::transaction(function () use ($tenant, $usage, $feature, $description, $cents, $paidAllowed): AiWalletEntry {
            $done = AiWalletEntry::query()->where('ai_usage_id', $usage->id)->first();
            if ($done !== null) {
                return $done;
            }
            $wallet = $this->locked($tenant->id);
            $free = $wallet->freeCents();
            $paid = $wallet->paidCents();
            $fromFree = min(max(0, $free), $cents);
            $rest = $cents - $fromFree;
            $fromPaid = $paidAllowed ? $rest : 0;
            // A call already made is charged in full: the overrun goes below zero on the pot it ran on.
            $fromFree += $paidAllowed ? 0 : $rest;

            $wallet->forceFill(['free_balance' => Money::toDecimal($free - $fromFree), 'paid_balance' => Money::toDecimal($paid - $fromPaid)])->save();
            $usage->forceFill(['charged_egp' => Money::toDecimal($cents)])->save();

            return AiWalletEntry::query()->create([
                'type' => 'charge',
                'amount' => Money::toDecimal(-$cents),
                'free_change' => Money::toDecimal(-$fromFree),
                'paid_change' => Money::toDecimal(-$fromPaid),
                'balance_after' => Money::toDecimal($wallet->freeCents() + $wallet->paidCents()),
                'feature' => $feature,
                'description' => mb_substr($description, 0, 200),
                'ai_usage_id' => $usage->id,
            ]);
        }));
        $this->warnIfLow($tenant);

        return $entry;
    }

    /**
     * Adds to a pot: a top-up and its offer (paid), the welcome credit or a gift (free).
     *
     * @param  'topup'|'bonus'|'welcome'|'gift'  $type
     */
    public function credit(Tenant $tenant, int $cents, string $type, ?string $description = null, ?int $invoiceId = null, ?int $adminId = null): ?AiWalletEntry
    {
        if ($cents <= 0) {
            return null;
        }
        $free = in_array($type, ['welcome', 'gift'], true);

        return Tenancy::runAs($tenant->id, fn (): AiWalletEntry => DB::transaction(function () use ($tenant, $cents, $type, $description, $invoiceId, $adminId, $free): AiWalletEntry {
            $wallet = $this->locked($tenant->id);
            $wallet->forceFill([
                $free ? 'free_balance' : 'paid_balance' => Money::toDecimal(($free ? $wallet->freeCents() : $wallet->paidCents()) + $cents),
                'low_notified_at' => null,
                'welcomed' => $wallet->welcomed || $type === 'welcome',
            ])->save();

            return AiWalletEntry::query()->create([
                'type' => $type,
                'amount' => Money::toDecimal($cents),
                'free_change' => Money::toDecimal($free ? $cents : 0),
                'paid_change' => Money::toDecimal($free ? 0 : $cents),
                'balance_after' => Money::toDecimal($wallet->freeCents() + $wallet->paidCents()),
                'description' => $description === null ? null : mb_substr($description, 0, 200),
                'invoice_id' => $invoiceId,
                'admin_id' => $adminId,
            ]);
        }));
    }

    /** The owner takes some balance back (free first, then paid; never below zero). */
    public function deduct(Tenant $tenant, int $cents, string $reason, int $adminId): ?AiWalletEntry
    {
        return Tenancy::runAs($tenant->id, fn (): ?AiWalletEntry => DB::transaction(function () use ($tenant, $cents, $reason, $adminId): ?AiWalletEntry {
            $wallet = $this->locked($tenant->id);
            $free = max(0, $wallet->freeCents());
            $paid = max(0, $wallet->paidCents());
            $take = min($cents, $free + $paid);
            if ($take <= 0) {
                return null;
            }
            $fromFree = min($free, $take);
            $fromPaid = $take - $fromFree;
            $wallet->forceFill(['free_balance' => Money::toDecimal($wallet->freeCents() - $fromFree), 'paid_balance' => Money::toDecimal($wallet->paidCents() - $fromPaid)])->save();

            return AiWalletEntry::query()->create([
                'type' => 'adjust',
                'amount' => Money::toDecimal(-$take),
                'free_change' => Money::toDecimal(-$fromFree),
                'paid_change' => Money::toDecimal(-$fromPaid),
                'balance_after' => Money::toDecimal($wallet->freeCents() + $wallet->paidCents()),
                'description' => mb_substr($reason, 0, 200),
                'admin_id' => $adminId,
            ]);
        }));
    }

    /** The welcome credit of a new store, once. */
    public function welcome(Tenant $tenant): void
    {
        $cents = $this->settings->welcomeCredit() * 100;
        if ($cents <= 0 || $this->wallet($tenant->id)->welcomed) {
            return;
        }
        $this->credit($tenant, $cents, 'welcome', __('ai.wallet.welcome'));
    }

    /** Told once when the balance falls under the owner's line (reset by the next credit). */
    private function warnIfLow(Tenant $tenant): void
    {
        $line = $this->settings->lowBalance() * 100;
        $wallet = $this->wallet($tenant->id);
        if ($line <= 0 || $wallet->low_notified_at !== null || $this->spendableCents($tenant) >= $line) {
            return;
        }
        Tenancy::runAs($tenant->id, fn () => $wallet->forceFill(['low_notified_at' => now()])->save());
        $left = Money::toDecimal($this->spendableCents($tenant));
        $this->center->toStore($tenant->id, new Notice(
            NotificationEvent::AiLowBalance,
            __('notifications.ai_low_balance.title'),
            __('notifications.ai_low_balance.body', ['left' => $left]),
            '/dashboard/settings/ai',
            [['label' => __('notifications.ai_low_balance.left'), 'value' => $left]],
            __('notifications.ai_low_balance.action'),
        ));
    }

    private function locked(int $tenantId): AiWallet
    {
        AiWallet::query()->firstOrCreate([]);

        return AiWallet::query()->where('tenant_id', $tenantId)->lockForUpdate()->firstOrFail();
    }
}
