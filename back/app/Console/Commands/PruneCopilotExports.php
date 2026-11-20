<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Ai\Copilot\Support\ExportBuilder;
use App\Models\CopilotExport;
use App\Tenancy\Tenancy;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Storage;

/** Daily: the copilot's Excel files past their 24 hours are deleted (file and row). */
final class PruneCopilotExports extends Command
{
    protected $signature = 'copilot:prune';

    protected $description = 'Delete the store copilot\'s expired Excel files';

    public function handle(): int
    {
        // Audited bypass: one cleanup across all tenants, only files past their expiry.
        $count = Tenancy::withoutTenant(function (): int {
            $old = CopilotExport::query()->where('expires_at', '<', now())->get(['id', 'path']);
            foreach ($old as $export) {
                Storage::disk(ExportBuilder::DISK)->delete($export->path);
            }

            return CopilotExport::query()->whereIn('id', $old->pluck('id'))->delete();
        });

        $this->info(sprintf('Pruned %d copilot files.', $count));

        return self::SUCCESS;
    }
}
