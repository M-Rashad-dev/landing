<?php

declare(strict_types=1);

namespace App\Actions\Identities;

use App\Models\Identity;
use Illuminate\Support\Facades\DB;

final class MakeIdentityDefault
{
    public function handle(Identity $identity): Identity
    {
        DB::transaction(function () use ($identity): void {
            Identity::query()->where('id', '!=', $identity->id)->where('is_default', true)->update(['is_default' => false]);
            $identity->forceFill(['is_default' => true])->save();
        });

        return $identity;
    }
}
