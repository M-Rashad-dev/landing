<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Ai\Designer\AiSectionCss;
use App\Models\AiSectionVersion;
use App\Tenancy\Tenancy;
use Illuminate\Console\Command;

/**
 * Re-scopes the stored CSS of every AI section version from the AI's own CSS, after the scoping
 * rules change (for example width media queries → container queries). Safe to run again.
 */
final class AiRescopeSections extends Command
{
    protected $signature = 'ai:rescope-sections';

    protected $description = 'Re-scope the CSS of every AI section version with the current rules';

    public function handle(): int
    {
        $done = 0;
        $failed = 0;
        // Audited bypass: a one-time maintenance pass over every store's AI sections (no data shown).
        Tenancy::withoutTenant(function () use (&$done, &$failed): void {
            AiSectionVersion::query()->orderBy('id')->chunkById(100, function ($versions) use (&$done, &$failed): void {
                foreach ($versions as $version) {
                    $result = AiSectionCss::scope((string) $version->css_raw, (string) $version->id);
                    if (($result['errors'] ?? []) !== []) {
                        $failed++;

                        continue;
                    }
                    $version->forceFill(['css' => $result['css']])->save();
                    $done++;
                }
            });
        });
        $this->info("Re-scoped {$done} version(s); {$failed} left as they were.");

        return self::SUCCESS;
    }
}
