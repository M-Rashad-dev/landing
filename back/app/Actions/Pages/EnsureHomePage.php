<?php

declare(strict_types=1);

namespace App\Actions\Pages;

use App\Enums\PageStatus;
use App\Models\LandingPage;

/**
 * A store with published pages always has a home page: when none is set (first publish, or the
 * home page was unpublished / deleted), the earliest published page becomes home.
 */
final class EnsureHomePage
{
    /** @param  LandingPage|null  $current  page in hand, updated in memory when it becomes home */
    public function handle(?LandingPage $current = null): void
    {
        if (LandingPage::query()->where('home_key', 1)->exists()) {
            return;
        }

        $first = LandingPage::query()->where('status', PageStatus::Published)->orderBy('published_at')->orderBy('id')->first();
        $first?->forceFill(['is_home' => true, 'home_key' => 1])->save();
        if ($first !== null && $current?->id === $first->id) {
            $current->forceFill(['is_home' => true, 'home_key' => 1])->syncOriginal();
        }
    }
}
