<?php

declare(strict_types=1);

namespace App\Support;

/** Collects media ids referenced by page content (keys ending in _media_id / _media_ids). */
final class ContentMedia
{
    /**
     * @param  array<mixed>|null  $content
     * @return list<int>
     */
    public static function extract(?array $content): array
    {
        $ids = [];
        self::walk($content ?? [], $ids);

        return array_values(array_unique($ids));
    }

    /**
     * @param  array<mixed>  $node
     * @param  list<int>  $ids
     */
    private static function walk(array $node, array &$ids): void
    {
        foreach ($node as $key => $value) {
            $key = (string) $key;

            if (str_ends_with($key, '_media_id') && (is_int($value) || (is_string($value) && ctype_digit($value)))) {
                $ids[] = (int) $value;

                continue;
            }

            if (str_ends_with($key, '_media_ids') && is_array($value)) {
                foreach ($value as $id) {
                    if (is_int($id) || (is_string($id) && ctype_digit($id))) {
                        $ids[] = (int) $id;
                    }
                }

                continue;
            }

            if (is_array($value)) {
                self::walk($value, $ids);
            }
        }
    }
}
