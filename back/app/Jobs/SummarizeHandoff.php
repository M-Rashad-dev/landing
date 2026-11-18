<?php

declare(strict_types=1);

namespace App\Jobs;

use App\Ai\SupportAssistant;
use App\Models\SupportTicket;
use App\Tenancy\Tenancy;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;

/** A short summary for the staff of a conversation the merchant moved to people with the button. */
final class SummarizeHandoff implements ShouldQueue
{
    use Dispatchable;
    use InteractsWithQueue;
    use Queueable;

    public int $tries = 1;

    public int $timeout = 120;

    public function __construct(public readonly int $tenantId, public readonly int $ticketId) {}

    public function handle(SupportAssistant $assistant): void
    {
        Tenancy::runAs($this->tenantId, function () use ($assistant): void {
            $ticket = SupportTicket::query()->find($this->ticketId);
            if ($ticket !== null) {
                $assistant->summarize($ticket);
            }
        });
    }
}
