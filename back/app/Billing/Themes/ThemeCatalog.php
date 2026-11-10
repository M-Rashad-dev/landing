<?php

declare(strict_types=1);

namespace App\Billing\Themes;

use App\Models\Theme;
use App\Models\ThemeImage;
use App\Models\ThemeTag;
use App\Support\Money;
use Illuminate\Support\Facades\Cache;

/**
 * Every theme with its store details, images and tags, cached as plain arrays and flushed by
 * any theme / image / tag save. Read by the store pages, access checks and public rendering.
 *
 * @phpstan-type ThemeRow array{key: string, name: string, kind: string, short_description: string|null, description: string|null, features: list<string>, price_cents: int, discount_percent: int, discount_starts_at: string|null, discount_ends_at: string|null, min_plan_key: string|null, is_featured: bool, is_listed: bool, is_active: bool, version: string|null, released_at: string|null, sort_order: int, images: list<array{id: int, kind: string, urls: array<string, string>, width: int, height: int}>, tags: list<array{id: int, slug: string, name: string}>}
 */
final class ThemeCatalog
{
    private const CACHE_KEY = 'themes:catalog:v1';

    /** @var array{themes: array<string, ThemeRow>, tags: list<array{id: int, slug: string, name: string}>}|null */
    private ?array $memo = null;

    /** @return array<string, ThemeRow> by key, in display order */
    public function all(): array
    {
        return $this->load()['themes'];
    }

    /** @return ThemeRow|null */
    public function theme(?string $key): ?array
    {
        return $key === null ? null : ($this->all()[$key] ?? null);
    }

    /** @return list<array{id: int, slug: string, name: string}> */
    public function tags(): array
    {
        return $this->load()['tags'];
    }

    /** Free = no base price; every store owns it. */
    public function isFree(string $key): bool
    {
        return ($this->theme($key)['price_cents'] ?? 0) === 0;
    }

    public static function flush(): void
    {
        Cache::forget(self::CACHE_KEY);

        if (app()->resolved(self::class)) {
            app(self::class)->memo = null;
        }
    }

    /** @return array{themes: array<string, ThemeRow>, tags: list<array{id: int, slug: string, name: string}>} */
    private function load(): array
    {
        return $this->memo ??= Cache::rememberForever(self::CACHE_KEY, function (): array {
            $themes = [];
            foreach (Theme::query()->with(['images', 'tags'])->orderBy('sort_order')->orderBy('key')->get() as $theme) {
                $themes[$theme->key] = [
                    'key' => $theme->key,
                    'name' => $theme->name,
                    'kind' => $theme->kind,
                    'short_description' => $theme->short_description,
                    'description' => $theme->description,
                    'features' => array_values($theme->features ?? []),
                    'price_cents' => Money::toCents((string) $theme->price),
                    'discount_percent' => $theme->discount_percent,
                    'discount_starts_at' => $theme->discount_starts_at?->toIso8601ZuluString(),
                    'discount_ends_at' => $theme->discount_ends_at?->toIso8601ZuluString(),
                    'min_plan_key' => $theme->min_plan_key,
                    'is_featured' => $theme->is_featured,
                    'is_listed' => $theme->is_listed,
                    'is_active' => $theme->is_active,
                    'version' => $theme->version,
                    'released_at' => $theme->released_at?->toIso8601ZuluString(),
                    'sort_order' => $theme->sort_order,
                    'images' => $theme->images->map(fn (ThemeImage $i) => ['id' => $i->id, 'kind' => $i->kind, 'urls' => $i->urls(), 'width' => $i->width, 'height' => $i->height])->values()->all(),
                    'tags' => $theme->tags->map(fn (ThemeTag $t) => ['id' => $t->id, 'slug' => $t->slug, 'name' => $t->name])->values()->all(),
                ];
            }

            $tags = ThemeTag::query()->orderBy('sort_order')->orderBy('name')->get()
                ->map(fn (ThemeTag $t) => ['id' => $t->id, 'slug' => $t->slug, 'name' => $t->name])->values()->all();

            return ['themes' => $themes, 'tags' => $tags];
        });
    }
}
