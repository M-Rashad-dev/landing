<?php

declare(strict_types=1);

namespace App\Jobs;

use App\Ai\Copilot\Changes\ChangeSetApplier;
use App\Models\CopilotChangeSet;
use App\Models\User;
use App\Tenancy\Tenancy;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Support\Facades\Auth;
use Throwable;

/** A costly copilot job the merchant started («ابدأ»): writes the texts / makes the images, then leaves a preview. */
final class RunCopilotJob implements ShouldQueue
{
    use Dispatchable;
    use InteractsWithQueue;
    use Queueable;

    public int $tries = 1;

    public int $timeout = 1800;

    public function __construct(public readonly int $tenantId, public readonly int $setId, public readonly int $userId) {}

    public function handle(ChangeSetApplier $applier): void
    {
        $user = User::query()->find($this->userId);
        if ($user === null) {
            return;
        }
        Auth::setUser($user);
        Tenancy::runAs($this->tenantId, function () use ($applier, $user): void {
            $set = CopilotChangeSet::query()->find($this->setId);
            if ($set instanceof CopilotChangeSet) {
                $applier->work($set, $user);
            }
        });
    }

    public function failed(Throwable $e): void
    {
        Tenancy::runAs($this->tenantId, function (): void {
            CopilotChangeSet::query()->whereKey($this->setId)->where('status', CopilotChangeSet::STATUS_RUNNING)
                ->update(['status' => CopilotChangeSet::STATUS_FAILED, 'error' => __('ai.copilot.changes.failed')]);
        });
    }
}
