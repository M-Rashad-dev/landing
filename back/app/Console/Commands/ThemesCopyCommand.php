<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Billing\Themes\ThemeCatalog;
use App\Models\Theme;
use Database\Seeders\ThemeSeeder;
use Illuminate\Console\Command;

/**
 * Writes the shipped texts of the platform's themes (short description, description, features,
 * tags) over what the admin has, for one theme or all of them. Prices, listing and images stay.
 */
final class ThemesCopyCommand extends Command
{
    protected $signature = 'themes:copy {key? : one theme, e.g. shabe (default: all shipped themes)}';

    protected $description = 'Write the shipped theme texts and tags again (prices and images untouched)';

    public function handle(): int
    {
        $key = $this->argument('key');
        $rows = array_values(array_filter(ThemeSeeder::THEMES, fn (array $t): bool => $key === null || $t['key'] === $key));
        if ($rows === []) {
            $this->error("No shipped theme «{$key}».");

            return self::FAILURE;
        }

        foreach ($rows as $row) {
            $theme = Theme::query()->find($row['key']);
            if ($theme === null) {
                $this->warn("«{$row['name']}» isn't in the database yet: run the seeders first.");

                continue;
            }
            ThemeSeeder::writeCopy($theme, $row);
            $this->info("«{$row['name']}» updated.");
        }
        ThemeCatalog::flush();

        return self::SUCCESS;
    }
}
