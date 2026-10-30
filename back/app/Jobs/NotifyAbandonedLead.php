<?php

declare(strict_types=1);

namespace App\Jobs;

use App\Enums\LeadStatus;
use App\Models\AbandonedLead;
use App\Services\Webhooks\WebhookDispatcher;
use App\Tenancy\Tenancy;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

/** Runs 30 minutes after a lead is captured: still no order from that visitor → lead.created. */
final class NotifyAbandonedLead implements ShouldQueue
{
    use Queueable;

    public const DELAY_MINUTES = 30;

    public function __construct(public readonly int $tenantId, public readonly int $leadId) {}

    public function handle(WebhookDispatcher $webhooks): void
    {
        Tenancy::runAs($this->tenantId, function () use ($webhooks): void {
            $lead = AbandonedLead::query()->whereKey($this->leadId)->where('status', LeadStatus::Open)->first();
            if ($lead !== null) {
                $webhooks->leadNow($lead);
            }
        });
    }
}
