<?php

declare(strict_types=1);

namespace App\Jobs;

use App\Models\AbandonedLead;
use App\Recovery\CartRecovery;
use App\Tenancy\Tenancy;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Support\Facades\Cache;

/**
 * The merchant's «ابعت تذكير» to every abandoned lead it can reach, or to the ones picked (docs/plans/
 * merchant-essentials.md, stage 4). Each message comes from the store's balance as usual; the store's lock is let go
 * at the end so the next send can start.
 */
final class SendManualReminders implements ShouldQueue
{
    use Dispatchable;
    use Queueable;

    public int $tries = 1;

    public int $timeout = 1800;

    /** @param list<int>|null $leadIds null = every lead it can reach (of $source when given) */
    public function __construct(public readonly int $tenantId, public readonly ?array $leadIds, public readonly ?string $source = null) {}

    public static function lockKey(int $tenantId): string
    {
        return 'cart-reminders-manual:'.$tenantId;
    }

    public function handle(CartRecovery $recovery): void
    {
        try {
            Tenancy::runAs($this->tenantId, function () use ($recovery): void {
                $recovery->manualTargets($this->leadIds, $this->source)->orderBy('id')
                    ->chunkById(100, fn ($leads) => $leads->each(fn (AbandonedLead $lead) => $recovery->remindNow($lead)));
            });
        } finally {
            Cache::forget(self::lockKey($this->tenantId));
        }
    }
}
