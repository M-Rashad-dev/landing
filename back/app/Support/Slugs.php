<?php

declare(strict_types=1);

namespace App\Support;

use App\Rules\PageSlug;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;

/** URL slugs from names (Arabic or Latin), unique inside the current tenant. */
final class Slugs
{
    /** "تيشيرت قطن 100%" → "تيشيرت-قطن-100". */
    public static function from(string $text, int $max = 60): string
    {
        $text = mb_strtolower(trim($text));
        $text = (string) preg_replace('/[^a-z0-9\p{Arabic}]+/u', '-', $text);
        $text = trim((string) preg_replace('/-+/', '-', $text), '-');
        $text = rtrim(mb_substr($text, 0, $max), '-');

        return preg_match(PageSlug::PATTERN, $text) === 1 && mb_strlen($text) >= 2 ? $text : 'item';
    }

    /**
     * A free slug for $name in $query's table (tenant-scoped query), adding -2, -3… when taken.
     *
     * @param  Builder<covariant Model>  $query
     */
    public static function unique(Builder $query, string $name, ?int $ignoreId = null, string $column = 'slug'): string
    {
        $base = self::from($name);
        $slug = $base;
        for ($n = 2; (clone $query)->where($column, $slug)->when($ignoreId !== null, fn ($q) => $q->whereKeyNot($ignoreId))->exists(); $n++) {
            $slug = $base.'-'.$n;
        }

        return $slug;
    }
}
