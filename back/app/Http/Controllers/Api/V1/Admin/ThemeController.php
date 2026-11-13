<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Admin;

use App\Actions\Admin\ManageTenant;
use App\Billing\Themes\ThemeAccess;
use App\Billing\Themes\ThemeCatalog;
use App\Billing\Themes\ThemeImageStore;
use App\Billing\Themes\ThemePresenter;
use App\Exceptions\ApiException;
use App\Http\Controllers\Concerns\RespondsWithJson;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\ThemeRequest;
use App\Models\LandingPage;
use App\Models\Store;
use App\Models\Tenant;
use App\Models\Theme;
use App\Models\ThemeImage;
use App\Models\ThemePurchase;
use App\Models\ThemeTag;
use App\Support\CairoTime;
use App\Support\Money;
use App\Tenancy\Tenancy;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

/**
 * «الثيمات» in the admin: turn themes on / off and run the theme store (details, price and
 * discount, images, tags), and give a paid theme to a store. Themes themselves are code.
 */
final class ThemeController extends Controller
{
    use RespondsWithJson;

    public function __construct(
        private readonly ThemeCatalog $catalog,
        private readonly ThemePresenter $presenter,
        private readonly ManageTenant $audit,
    ) {}

    public function index(): JsonResponse
    {
        $usage = $this->usage();

        return $this->ok(array_values(array_map(fn (array $t) => $this->row($t, $usage), $this->catalog->all())), ['tags' => $this->catalog->tags()]);
    }

    public function show(string $key): JsonResponse
    {
        $theme = $this->catalog->theme($key) ?? abort(404);

        return $this->ok($this->row($theme, $this->usage()), ['tags' => $this->catalog->tags()]);
    }

    /** Only on / off (kept for the quick switch in the list). */
    public function update(Request $request, string $key): JsonResponse
    {
        $data = $request->validate(['is_active' => ['required', 'boolean']]);
        $theme = Theme::query()->findOrFail($key);
        $theme->forceFill(['is_active' => (bool) $data['is_active']])->save();
        $this->audit->audit($theme->is_active ? 'theme.enable' : 'theme.disable', $theme->key, [], 'theme');

        return $this->show($key);
    }

    public function updateDetails(ThemeRequest $request, string $key): JsonResponse
    {
        $theme = Theme::query()->findOrFail($key);
        $data = $request->validated();
        $before = $theme->only(['name', 'price', 'discount_percent', 'is_listed', 'min_plan_key']);
        $clean = fn (?string $v) => $v === null ? null : (trim(strip_tags($v)) ?: null);

        $theme->update([
            'name' => $clean($data['name']),
            'kind' => $data['kind'],
            'short_description' => $clean($data['short_description'] ?? null),
            'description' => $clean($data['description'] ?? null),
            'features' => array_values(array_filter(array_map(fn ($f) => $clean((string) $f), $data['features'] ?? []))),
            'price' => Money::toDecimal(Money::toCents((string) $data['price'])),
            'discount_percent' => (int) ($data['discount_percent'] ?? 0),
            'discount_starts_at' => CairoTime::parse($data['discount_starts_at'] ?? null),
            'discount_ends_at' => CairoTime::parse($data['discount_ends_at'] ?? null),
            'min_plan_key' => $data['min_plan_key'] ?? null,
            'is_featured' => (bool) $data['is_featured'],
            'is_listed' => (bool) $data['is_listed'],
            'version' => $clean($data['version'] ?? null),
            'released_at' => CairoTime::parse($data['released_at'] ?? null) ?? $theme->released_at ?? now(),
        ]);
        $theme->tags()->sync($data['tag_ids'] ?? []);
        ThemeCatalog::flush();
        $this->audit->audit('theme.update', $theme->key, ['before' => $before, 'after' => $theme->only(array_keys($before))], 'theme');

        return $this->show($key);
    }

    public function storeImage(Request $request, string $key, ThemeImageStore $images): JsonResponse
    {
        $theme = Theme::query()->findOrFail($key);
        $data = $request->validate([
            'image' => ['required', 'file', 'max:5120', 'mimes:jpg,jpeg,png,webp'],
            'kind' => ['required', Rule::in(ThemeImage::KINDS)],
        ]);
        $stored = $images->store($request->file('image'), $theme->key);

        ThemeImage::query()->create($stored + [
            'theme_key' => $theme->key,
            'kind' => $data['kind'],
            'position' => (int) ThemeImage::query()->where('theme_key', $theme->key)->max('position') + 1,
        ]);

        return $this->show($key);
    }

    public function destroyImage(string $key, int $image, ThemeImageStore $images): JsonResponse
    {
        $row = ThemeImage::query()->where('theme_key', $key)->findOrFail($image);
        $images->delete($row->variants);
        $row->delete();

        return $this->show($key);
    }

    public function reorderImages(Request $request, string $key): JsonResponse
    {
        $data = $request->validate(['ids' => ['required', 'array', 'max:50'], 'ids.*' => ['integer', 'distinct']]);
        $rows = ThemeImage::query()->where('theme_key', $key)->get()->keyBy('id');
        abort_if(count($data['ids']) !== $rows->count() || collect($data['ids'])->contains(fn ($id) => ! $rows->has($id)), 422);

        foreach (array_values($data['ids']) as $position => $id) {
            $rows[$id]->forceFill(['position' => $position])->save();
        }

        return $this->show($key);
    }

    public function storeTag(Request $request): JsonResponse
    {
        $data = $request->validate(['name' => ['required', 'string', 'min:2', 'max:60']]);
        $name = trim(strip_tags($data['name']));
        $slug = Str::slug($name) !== '' ? Str::slug($name) : 'tag-'.Str::lower(Str::random(6));

        $tag = ThemeTag::query()->firstOrCreate(['slug' => $slug], ['name' => $name, 'sort_order' => (int) ThemeTag::query()->max('sort_order') + 1]);

        return $this->created(['id' => $tag->id, 'slug' => $tag->slug, 'name' => $tag->name]);
    }

    public function destroyTag(int $tag): Response
    {
        ThemeTag::query()->findOrFail($tag)->delete();

        return $this->noContent();
    }

    /** Themes a store owns, with the admin's gifts. */
    public function tenantThemes(int $tenant): JsonResponse
    {
        $model = Tenant::query()->findOrFail($tenant);
        $rows = Tenancy::runAs($model->id, fn () => ThemePurchase::query()->orderBy('id')->get());

        return $this->ok($rows->map(fn (ThemePurchase $p) => [
            'theme_key' => $p->theme_key,
            'name' => $this->catalog->theme($p->theme_key)['name'] ?? $p->theme_key,
            'source' => $p->source,
            'price_paid' => Money::toFloat(Money::toCents((string) $p->price_paid)),
            'note' => $p->note,
            'created_at' => $p->created_at?->toIso8601ZuluString(),
        ])->all());
    }

    public function grant(Request $request, int $tenant, ThemeAccess $access): JsonResponse
    {
        $data = $request->validate([
            'theme_key' => ['required', 'string', Rule::exists('themes', 'key')],
            'note' => ['nullable', 'string', 'max:300'],
        ]);
        $model = Tenant::query()->findOrFail($tenant);
        if ($access->owns($model, $data['theme_key'])) {
            throw new ApiException(422, 'theme_owned', __('themes.grant_exists'));
        }

        $access->grant($model, $data['theme_key'], 'admin_grant', null, 0, isset($data['note']) ? trim(strip_tags($data['note'])) : null, $request->user()?->getAuthIdentifier());
        $this->audit->audit('theme.grant', $model, ['theme_key' => $data['theme_key']]);

        return $this->tenantThemes($tenant);
    }

    /** Only the admin's own gifts can be taken back (a bought theme is the store's forever). */
    public function revoke(int $tenant, string $key): Response
    {
        $model = Tenant::query()->findOrFail($tenant);
        $purchase = Tenancy::runAs($model->id, fn () => ThemePurchase::query()->where('theme_key', $key)->firstOrFail());
        if ($purchase->source !== 'admin_grant') {
            throw new ApiException(422, 'theme_purchased', __('themes.revoke_purchase'));
        }

        Tenancy::runAs($model->id, fn () => $purchase->delete());
        $this->audit->audit('theme.revoke', $model, ['theme_key' => $key]);

        return $this->noContent();
    }

    /** @return array<string, int> stores running each theme + landing pages using it (audited bypass: platform-wide counts). */
    private function usage(): array
    {
        return Tenancy::withoutTenant(function (): array {
            $usage = [];
            $pages = LandingPage::query()->selectRaw('theme_key, count(*) as total')->groupBy('theme_key')->pluck('total', 'theme_key');
            $stores = Store::query()->selectRaw('theme_key, count(*) as total')->groupBy('theme_key')->pluck('total', 'theme_key');
            foreach ([$pages, $stores] as $counts) {
                foreach ($counts as $key => $total) {
                    $usage[(string) $key] = ($usage[(string) $key] ?? 0) + (int) $total;
                }
            }

            return $usage;
        });
    }

    /**
     * @param  array<string, mixed>  $theme
     * @param  array<string, int>  $usage
     * @return array<string, mixed>
     */
    private function row(array $theme, array $usage): array
    {
        return $this->presenter->row($theme, null, detail: true) + [
            'is_active' => $theme['is_active'],
            'is_listed' => $theme['is_listed'],
            'sort_order' => $theme['sort_order'],
            'in_use' => $usage[$theme['key']] ?? 0,
            'raw' => [
                'price' => $theme['price_cents'] / 100,
                'discount_percent' => $theme['discount_percent'],
                'discount_starts_at' => $theme['discount_starts_at'],
                'discount_ends_at' => $theme['discount_ends_at'],
                'min_plan_key' => $theme['min_plan_key'],
                'is_featured' => $theme['is_featured'],
                'tag_ids' => array_column($theme['tags'], 'id'),
            ],
        ];
    }
}
