<?php

declare(strict_types=1);

namespace App\Support;

use Illuminate\Support\Str;

/** Plain text out of the small Markdown subset product descriptions use (meta descriptions, JSON-LD). */
final class PlainText
{
    public static function fromMarkdown(?string $markdown, int $limit = 160): string
    {
        if ($markdown === null || trim($markdown) === '') {
            return '';
        }

        $text = strip_tags($markdown);
        $text = (string) preg_replace('/!\[[^\]]*\]\([^)]*\)/u', '', $text);   // images
        $text = (string) preg_replace('/\[([^\]]*)\]\([^)]*\)/u', '$1', $text); // links → label
        $text = (string) preg_replace('/^\s{0,3}(#{1,6}|>|[-*+]|\d+\.)\s+/mu', '', $text);
        $text = str_replace(['**', '__', '~~', '`'], '', $text);
        $text = (string) preg_replace('/(?<![\p{L}\p{N}])[*_]|[*_](?![\p{L}\p{N}])/u', '', $text);
        $text = trim((string) preg_replace('/\s+/u', ' ', $text));

        return Str::limit($text, $limit, '…', preserveWords: true);
    }
}
