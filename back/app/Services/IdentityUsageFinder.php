<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\Identity;
use App\Models\LandingPage;

/** Pages (published or not, not deleted) that use an identity. */
final class IdentityUsageFinder
{
    /** @return list<array{id: int, title: string}> */
    public function pages(Identity $identity): array
    {
        return LandingPage::query()
            ->where('identity_id', $identity->id)
            ->get(['id', 'title'])
            ->map(fn (LandingPage $page) => ['id' => $page->id, 'title' => $page->title])
            ->all();
    }
}
