<?php

declare(strict_types=1);

namespace App\Actions\Identities;

use App\Exceptions\ApiException;
use App\Models\Identity;
use App\Services\IdentityUsageFinder;

final class DeleteIdentity
{
    public function __construct(private readonly IdentityUsageFinder $usages) {}

    public function handle(Identity $identity): void
    {
        if ($identity->is_default) {
            throw ApiException::conflict('identity_is_default', __('landing.identity_default_delete'));
        }

        $pages = $this->usages->pages($identity);

        if ($pages !== []) {
            throw ApiException::conflict('identity_in_use', __('landing.identity_in_use'), ['pages' => $pages]);
        }

        $identity->delete();
    }
}
