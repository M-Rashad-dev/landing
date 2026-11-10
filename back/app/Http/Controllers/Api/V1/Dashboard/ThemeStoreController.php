<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Dashboard;

use App\Billing\Payments\Invoices;
use App\Billing\Themes\ThemeCatalog;
use App\Billing\Themes\ThemePresenter;
use App\Http\Controllers\Concerns\RespondsWithJson;
use App\Http\Controllers\Controller;
use App\Http\Resources\InvoiceResource;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/** «الثيمات»: the store's themes, the theme store with filters, one theme, buying it. */
final class ThemeStoreController extends Controller
{
    use RespondsWithJson;

    public function __construct(private readonly ThemeCatalog $catalog, private readonly ThemePresenter $presenter) {}

    /** Every active theme with whether the store owns / can publish it (wizard, builder, «ثيماتي»). */
    public function mine(Request $request): JsonResponse
    {
        $tenant = $this->tenant($request);
        $rows = array_values(array_map(
            fn (array $theme) => $this->presenter->row($theme, $tenant),
            array_filter($this->catalog->all(), fn (array $t) => $t['is_active']),
        ));

        return $this->ok($rows);
    }

    public function index(Request $request): JsonResponse
    {
        $data = $request->validate([
            'kind' => ['nullable', Rule::in(['landing', 'store'])],
            'tag' => ['nullable', 'string', 'max:60'],
            'price' => ['nullable', Rule::in(['free', 'paid'])],
            'q' => ['nullable', 'string', 'max:60'],
            'sort' => ['nullable', Rule::in(['newest', 'popular', 'price_asc', 'price_desc'])],
        ]);
        $tenant = $this->tenant($request);
        $q = mb_strtolower(trim((string) ($data['q'] ?? '')));

        $rows = collect($this->catalog->all())
            ->filter(fn (array $t) => $t['is_active'] && $t['is_listed'])
            ->filter(fn (array $t) => ! isset($data['kind']) || $t['kind'] === $data['kind'])
            ->filter(fn (array $t) => ! isset($data['tag']) || collect($t['tags'])->contains('slug', $data['tag']))
            ->filter(fn (array $t) => ! isset($data['price']) || ($data['price'] === 'free') === ($t['price_cents'] === 0))
            ->filter(fn (array $t) => $q === '' || str_contains(mb_strtolower($t['name'].' '.$t['short_description']), $q))
            ->map(fn (array $t) => $this->presenter->row($t, $tenant))
            ->values();

        $rows = match ($data['sort'] ?? 'newest') {
            'popular' => $rows->sortByDesc('sales'),
            'price_asc' => $rows->sortBy(fn (array $r) => $r['price']['final'] ?? 0),
            'price_desc' => $rows->sortByDesc(fn (array $r) => $r['price']['final'] ?? 0),
            default => $rows->sortByDesc(fn (array $r) => ($r['is_featured'] ? '1' : '0').($r['released_at'] ?? '')),
        };

        return $this->ok($rows->values()->all(), ['tags' => $this->catalog->tags()]);
    }

    public function show(Request $request, string $key): JsonResponse
    {
        $theme = $this->catalog->theme($key);
        abort_if($theme === null || ! $theme['is_active'] || ! $theme['is_listed'], 404);

        return $this->ok($this->presenter->row($theme, $this->tenant($request), detail: true));
    }

    public function buy(Request $request, string $key, Invoices $invoices): JsonResponse
    {
        $invoice = $invoices->forTheme($this->tenant($request), $key);

        return $this->created(InvoiceResource::make($invoice->load('payments.method:key,name')));
    }

    private function tenant(Request $request): Tenant
    {
        /** @var User $user */
        $user = $request->user();

        return $user->tenant ?? abort(403);
    }
}
