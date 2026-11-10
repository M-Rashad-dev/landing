<?php

declare(strict_types=1);

namespace App\Rules;

use App\Billing\Themes\ThemeAccess;
use App\Models\Tenant;
use App\Tenancy\Tenancy;
use Closure;
use Illuminate\Contracts\Validation\ValidationRule;

/** The current store owns this theme (free, bought or given). Paid themes it does not own need buying first. */
final class OwnedTheme implements ValidationRule
{
    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        $tenantId = Tenancy::id();
        $tenant = $tenantId === null ? null : Tenant::query()->find($tenantId);

        if (! is_string($value) || $tenant === null || ! app(ThemeAccess::class)->owns($tenant, $value)) {
            $fail(__('pages.theme_not_owned'));
        }
    }
}
