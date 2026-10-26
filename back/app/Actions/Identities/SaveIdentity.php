<?php

declare(strict_types=1);

namespace App\Actions\Identities;

use App\Jobs\RevalidateTenantHosts;
use App\Models\Identity;
use App\Tenancy\Tenancy;
use Illuminate\Support\Facades\DB;

final class SaveIdentity
{
    /** @param array<string, mixed> $data */
    public function handle(array $data, ?Identity $identity = null): Identity
    {
        $identity = DB::transaction(function () use ($data, $identity): Identity {
            if ($identity === null) {
                $identity = new Identity($data);
                // The first identity of a tenant is always the default one.
                $identity->is_default = ! Identity::query()->exists();
                $identity->save();

                return $identity;
            }

            $identity->fill($data)->save();

            return $identity;
        });

        RevalidateTenantHosts::dispatch((int) Tenancy::id())->afterCommit();

        return $identity;
    }
}
