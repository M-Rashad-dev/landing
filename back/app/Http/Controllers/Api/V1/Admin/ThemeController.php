<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Admin;

use App\Actions\Admin\ManageTenant;
use App\Http\Controllers\Concerns\RespondsWithJson;
use App\Http\Controllers\Controller;
use App\Models\LandingPage;
use App\Models\Theme;
use App\Tenancy\Tenancy;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** Enable / disable themes. Disabling only hides a theme from new pages; existing pages keep it. */
final class ThemeController extends Controller
{
    use RespondsWithJson;

    public function index(): JsonResponse
    {
        // Audited bypass: platform-wide usage count per theme.
        $usage = Tenancy::withoutTenant(fn () => LandingPage::query()->selectRaw('theme_key, count(*) as total')->groupBy('theme_key')->pluck('total', 'theme_key'));

        return $this->ok(Theme::query()->orderBy('sort_order')->get()->map(fn (Theme $theme) => $this->row($theme, (int) ($usage[$theme->key] ?? 0)))->all());
    }

    public function update(Request $request, string $key, ManageTenant $audit): JsonResponse
    {
        $data = $request->validate(['is_active' => ['required', 'boolean']]);
        $theme = Theme::query()->findOrFail($key);
        $theme->forceFill(['is_active' => (bool) $data['is_active']])->save();
        $audit->audit($theme->is_active ? 'theme.enable' : 'theme.disable', $theme->key, [], 'theme');

        // Audited bypass: platform-wide usage count for this theme.
        $pages = Tenancy::withoutTenant(fn () => LandingPage::query()->where('theme_key', $theme->key)->count());

        return $this->ok($this->row($theme, $pages));
    }

    /** @return array<string, mixed> */
    private function row(Theme $theme, int $pages): array
    {
        return ['key' => $theme->key, 'name' => $theme->name, 'is_active' => $theme->is_active, 'sort_order' => $theme->sort_order, 'pages_count' => $pages];
    }
}
