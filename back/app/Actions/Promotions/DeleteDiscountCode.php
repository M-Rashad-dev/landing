<?php

declare(strict_types=1);

namespace App\Actions\Promotions;

use App\Jobs\RevalidateTenantHosts;
use App\Models\DiscountCode;
use App\Tenancy\Tenancy;
use Illuminate\Support\Facades\DB;

/**
 * Soft delete that frees the code value: the row is renamed CODE--DEL{id}
 * (the unique index covers soft-deleted rows too).
 */
final class DeleteDiscountCode
{
    public function handle(DiscountCode $code): void
    {
        DB::transaction(function () use ($code): void {
            $code->forceFill(['code' => mb_substr($code->code, 0, 40).'--DEL'.$code->id])->save();
            $code->delete();
        });

        RevalidateTenantHosts::dispatch((int) Tenancy::id())->afterCommit();
    }
}
