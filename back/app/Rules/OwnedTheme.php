<?php

declare(strict_types=1);

namespace App\Rules;

use App\Billing\Themes\ThemeAccess;
use App\Billing\Themes\ThemeCatalog;
use App\Models\Tenant;
use App\Tenancy\Tenancy;
use Closure;
use Illuminate\Contracts\Validation\ValidationRule;

/**
 * The current store owns this theme (free, bought or given) and the theme fits the page:
 * landing pages use landing themes, the store home uses store themes.
 */
final class OwnedTheme implements ValidationRule
{
    public function __construct(private readonly string $kind = 'landing') {}

    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        $tenantId = Tenancy::id();
        $tenant = $tenantId === null ? null : Tenant::query()->find($tenantId);

        if (! is_string($value) || $tenant === null) {
            $fail(__('pages.theme_not_owned'));

            return;
        }

        if ((app(ThemeCatalog::class)->theme($value)['kind'] ?? null) !== $this->kind) {
            $fail(__('pages.theme_wrong_kind'));

            return;
        }

        if (! app(ThemeAccess::class)->owns($tenant, $value)) {
            $fail(__('pages.theme_not_owned'));
        }
    }
}
