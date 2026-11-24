<?php

declare(strict_types=1);

namespace App\Recovery;

use App\Billing\PlatformSettings;
use App\Models\MessageWallet;
use App\Models\MessageWalletEntry;
use App\Tenancy\Tenancy;
use Illuminate\Support\Facades\DB;

/**
 * The store's WhatsApp message balance for cart reminders: packs bought through a billing invoice add to it, every
 * reminder sent takes one, a reminder WhatsApp could not deliver gives it back. Never below zero.
 */
final class MessageWallets
{
    public function __construct(private readonly PlatformSettings $settings) {}

    public function balance(int $tenantId): int
    {
        return Tenancy::runAs($tenantId, fn (): int => (int) (MessageWallet::query()->value('balance') ?? 0));
    }

    /**
     * The packs the platform sells: [{messages, price}] (price in EGP), cheapest first.
     *
     * @return list<array{messages: int, price: int}>
     */
    public function packs(): array
    {
        $packs = [];
        foreach ((array) $this->settings->all()['message_packs'] as $pack) {
            $messages = (int) ($pack['messages'] ?? 0);
            $price = (int) ($pack['price'] ?? 0);
            if ($messages > 0 && $price > 0) {
                $packs[] = ['messages' => $messages, 'price' => $price];
            }
        }
        usort($packs, fn (array $a, array $b) => $a['messages'] <=> $b['messages']);

        return $packs;
    }

    /** @return array{messages: int, price: int}|null */
    public function pack(int $messages): ?array
    {
        foreach ($this->packs() as $pack) {
            if ($pack['messages'] === $messages) {
                return $pack;
            }
        }

        return null;
    }

    /** Adds messages (a paid pack, a refund, an admin adjustment). */
    public function credit(int $tenantId, int $messages, string $type, string $description, ?int $invoiceId = null): void
    {
        if ($messages <= 0) {
            return;
        }
        Tenancy::runAs($tenantId, fn () => DB::transaction(function () use ($messages, $type, $description, $invoiceId): void {
            $wallet = $this->locked();
            $wallet->forceFill(['balance' => $wallet->balance + $messages, 'empty_notified_at' => null])->save();
            MessageWalletEntry::query()->create(['type' => $type, 'messages' => $messages, 'balance_after' => $wallet->balance, 'description' => $description, 'invoice_id' => $invoiceId]);
        }));
    }

    /** Takes one message for a reminder; false when the balance is empty. Runs inside the store's tenant. */
    public function charge(string $description): bool
    {
        return DB::transaction(function () use ($description): bool {
            $wallet = $this->locked();
            if ($wallet->balance < 1) {
                return false;
            }
            $wallet->forceFill(['balance' => $wallet->balance - 1])->save();
            MessageWalletEntry::query()->create(['type' => 'charge', 'messages' => -1, 'balance_after' => $wallet->balance, 'description' => $description]);

            return true;
        });
    }

    /** The wallet row, locked (made on first use). */
    private function locked(): MessageWallet
    {
        $wallet = MessageWallet::query()->lockForUpdate()->first();
        if ($wallet === null) {
            $wallet = MessageWallet::query()->create(['balance' => 0]);
            $wallet = MessageWallet::query()->whereKey($wallet->id)->lockForUpdate()->firstOrFail();
        }

        return $wallet;
    }
}
