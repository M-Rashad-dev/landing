<?php

declare(strict_types=1);

namespace App\Jobs;

use App\Ai\Designer\AiDesignRunner;
use App\Models\AiDesignRun;
use App\Tenancy\Tenancy;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Throwable;

/**
 * Executes a whole-page / whole-store AI design run inside the tenant context (docs/plans/ai-designer.md §4.5).
 */
final class RunDesign implements ShouldQueue
{
    use Dispatchable;
    use InteractsWithQueue;
    use Queueable;

    public int $tries = 1;

    public int $timeout = 600;

    public function __construct(
        public readonly int $tenantId,
        public readonly int $runId,
    ) {}

    public function handle(AiDesignRunner $runner): void
    {
        Tenancy::runAs($this->tenantId, function () use ($runner): void {
            $run = AiDesignRun::query()->with('chat')->find($this->runId);
            if ($run instanceof AiDesignRun) {
                $runner->execute($run);
            }
        });
    }

    public function failed(Throwable $e): void
    {
        Tenancy::runAs($this->tenantId, function (): void {
            $run = AiDesignRun::query()->find($this->runId);
            if ($run instanceof AiDesignRun && in_array($run->status, AiDesignRun::ACTIVE_STATUSES, true)) {
                $run->forceFill([
                    'status' => 'failed',
                    'error' => __('ai.designer.unavailable'),
                ])->save();
            }
        });
    }
}
