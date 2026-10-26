<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\Identity;

/** Pages (published or not, not deleted) that use an identity. */
final class IdentityUsageFinder
{
    /** @return list<array{id: int, title: string}> */
    public function pages(Identity $identity): array
    {
        return [];
    }
}
