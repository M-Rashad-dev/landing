<?php

declare(strict_types=1);

namespace App\Jobs;

use App\Ai\SupportAssistant;
use App\Models\SupportTicket;
use App\Services\Support\SupportDesk;
use App\Tenancy\Tenancy;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Throwable;

/** The assistant answers the merchant's new message(s) in the store's own tenant; any failure hands the conversation to people. */
final class AnswerSupport implements ShouldQueue
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
                $assistant->answer($ticket);
            }
        });
    }

    public function failed(Throwable $e): void
    {
        Tenancy::runAs($this->tenantId, function (): void {
            $ticket = SupportTicket::query()->find($this->ticketId);
            if ($ticket !== null) {
                app(SupportDesk::class)->handOff($ticket, 'unavailable', null);
            }
        });
    }
}
