<?php

declare(strict_types=1);

namespace App\Billing\Themes;

use App\Billing\BillingPriceCalculator;
use App\Billing\PlanCatalog;
use App\Models\Tenant;
use App\Models\ThemePurchase;
use App\Tenancy\Tenancy;
use Carbon\CarbonImmutable;

/** Theme store JSON: catalog details, today's price, and (for a store) whether it owns / can publish it. */
final class ThemePresenter
{
    /** Themes released in the last days are marked "new". */
    private const NEW_DAYS = 30;

    /** @var array<string, int>|null */
    private ?array $sales = null;

    public function __construct(
        private readonly ThemeCatalog $catalog,
        private readonly BillingPriceCalculator $prices,
        private readonly ThemeAccess $access,
        private readonly PlanCatalog $plans,
    ) {}

    /**
     * @param  array<string, mixed>  $theme  a ThemeCatalog row
     * @return array<string, mixed>
     */
    public function row(array $theme, ?Tenant $tenant, bool $detail = false): array
    {
        $price = $this->prices->themePrice($theme['key']);
        $cover = collect($theme['images'])->firstWhere('kind', 'cover') ?? ($theme['images'][0] ?? null);
        $released = $theme['released_at'] === null ? null : CarbonImmutable::parse($theme['released_at']);

        $row = [
            'key' => $theme['key'],
            'name' => $theme['name'],
            'kind' => $theme['kind'],
            'short_description' => $theme['short_description'],
            'price' => $price?->toArray(),
            'is_free' => $price === null || $price->isFree(),
            'is_featured' => $theme['is_featured'],
            'is_new' => $released !== null && $released->gt(now()->subDays(self::NEW_DAYS)),
            'released_at' => $theme['released_at'],
            'cover' => $cover['urls'] ?? null,
            'tags' => $theme['tags'],
            'sales' => $this->sales()[$theme['key']] ?? 0,
            'min_plan' => $theme['min_plan_key'] === null ? null : ['key' => $theme['min_plan_key'], 'name' => $this->plans->plan($theme['min_plan_key'])['name'] ?? $theme['min_plan_key']],
        ];

        if ($tenant !== null) {
            $row['owned'] = $this->access->owns($tenant, $theme['key']);
            $row['can_publish'] = $this->access->canPublish($tenant, $theme['key']);
        }

        if ($detail) {
            $row += [
                'description' => $theme['description'],
                'features' => $theme['features'],
                'images' => $theme['images'],
                'version' => $theme['version'],
            ];
        }

        return $row;
    }

    /** Stores that own each paid theme. @return array<string, int> */
    public function sales(): array
    {
        // Audited bypass: platform-wide purchase counts per theme (no tenant data leaves this method).
        return $this->sales ??= Tenancy::withoutTenant(fn (): array => ThemePurchase::query()
            ->selectRaw('theme_key, count(*) as total')
            ->groupBy('theme_key')
            ->pluck('total', 'theme_key')
            ->map(fn ($n) => (int) $n)
            ->all());
    }
}
