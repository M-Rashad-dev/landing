<?php

declare(strict_types=1);

namespace App\Imports\Products;

/**
 * Turns messy cells into clean values: prices written as "1,250.50 ج.م", "EGP 500", "١٥٠",
 * "1.250,50"; quantities; yes / no / منشور / draft; image links in one cell; HTML descriptions.
 */
final class CellParser
{
    /** Western digits for Arabic-Indic and Persian ones. */
    public static function digits(string $text): string
    {
        return strtr($text, [
            '٠' => '0', '١' => '1', '٢' => '2', '٣' => '3', '٤' => '4', '٥' => '5', '٦' => '6', '٧' => '7', '٨' => '8', '٩' => '9',
            '۰' => '0', '۱' => '1', '۲' => '2', '۳' => '3', '۴' => '4', '۵' => '5', '۶' => '6', '۷' => '7', '۸' => '8', '۹' => '9',
            '٫' => '.', '٬' => ',',
        ]);
    }

    /**
     * A money amount as a decimal string ("1250.50"), null for an empty cell, false when it is not a number.
     */
    public static function money(string $cell): string|false|null
    {
        $text = self::digits(trim($cell));
        if ($text === '') {
            return null;
        }
        // Drop currency names / signs and spaces, keep digits, separators and a minus.
        $text = (string) preg_replace('/[^\d.,\-]/u', '', $text);
        // Separators left over from words like "ج.م" at either end.
        $text = trim($text, '.,');
        if ($text === '' || preg_match('/\d/', $text) !== 1) {
            return false;
        }
        $lastDot = strrpos($text, '.');
        $lastComma = strrpos($text, ',');
        if ($lastDot !== false && $lastComma !== false) {
            // Both: the later one is the decimal mark.
            $decimal = $lastDot > $lastComma ? '.' : ',';
            $thousands = $decimal === '.' ? ',' : '.';
            $text = str_replace([$thousands, $decimal], ['', '.'], $text);
        } elseif ($lastComma !== false) {
            // "12,5" / "12,50" → decimal comma; "1,250" / "1,250,000" → thousands.
            $text = preg_match('/,\d{1,2}$/', $text) === 1 && substr_count($text, ',') === 1 ? str_replace(',', '.', $text) : str_replace(',', '', $text);
        } elseif ($lastDot !== false && substr_count($text, '.') > 1) {
            $text = str_replace('.', '', $text); // "1.250.000"
        }
        if (preg_match('/^-?\d+(\.\d+)?$/', $text) !== 1) {
            return false;
        }

        return number_format(round((float) $text, 2), 2, '.', '');
    }

    /** A whole quantity, null for empty / unlimited, false when unreadable. Negative stock counts as 0. */
    public static function quantity(string $cell): int|false|null
    {
        $text = mb_strtolower(trim(self::digits($cell)));
        if ($text === '' || in_array($text, ['unlimited', 'غير محدود', 'مفتوح', '∞', '-'], true)) {
            return null;
        }
        $text = (string) preg_replace('/[\s,]/u', '', $text);
        if (preg_match('/^-?\d+(\.0+)?$/', $text) !== 1) {
            return false;
        }

        return max(0, min(1_000_000, (int) $text));
    }

    /** Visible (true) / hidden (false) from status words; null when empty or unknown. */
    public static function visible(string $cell): ?bool
    {
        $text = mb_strtolower(trim($cell));
        if ($text === '') {
            return null;
        }
        $on = ['1', 'true', 'yes', 'y', 'active', 'published', 'publish', 'visible', 'enabled', 'on', 'نعم', 'اه', 'ايوه', 'ظاهر', 'منشور', 'نشط', 'مفعل', 'متاح', 'شغال', 'فعال'];
        $off = ['0', 'false', 'no', 'n', 'draft', 'archived', 'hidden', 'disabled', 'inactive', 'private', 'off', 'لا', 'مخفي', 'مسوده', 'مسودة', 'غير متاح', 'متوقف', 'موقوف', 'غير نشط', 'مؤرشف'];

        return in_array($text, $on, true) ? true : (in_array($text, $off, true) ? false : null);
    }

    /**
     * Image links in a cell (separated by commas, new lines, spaces or "|"); http(s) only.
     *
     * @return list<string>
     */
    public static function urls(string $cell): array
    {
        $parts = preg_split('/[\s,|;]+/u', trim($cell)) ?: [];
        $urls = [];
        foreach ($parts as $part) {
            $part = trim($part, " \t\"'");
            if (preg_match('#^https?://[^\s<>"]+$#i', $part) === 1 && strlen($part) <= 1000) {
                $urls[] = $part;
            }
        }

        return array_values(array_unique($urls));
    }

    /**
     * Category paths: "ملابس > رجالي, أحذية" → [["ملابس","رجالي"], ["أحذية"]].
     *
     * @return list<list<string>>
     */
    public static function categories(string $cell): array
    {
        $paths = [];
        foreach (preg_split('/[,|،]+/u', trim($cell)) ?: [] as $path) {
            $names = array_values(array_filter(array_map(fn ($n) => mb_substr(trim(strip_tags($n)), 0, 100), preg_split('/\s*[>»]\s*/u', $path) ?: []), fn ($n) => $n !== ''));
            if ($names !== []) {
                $paths[] = array_slice($names, 0, (int) config('landing.limits.category_depth', 5));
            }
        }

        return array_slice($paths, 0, 5);
    }

    /** Plain text with paragraphs and "- " bullets from an HTML description (Shopify, Woo); plain text stays as is. */
    public static function text(string $cell): string
    {
        $text = trim(str_replace("\r\n", "\n", $cell));
        if ($text === '' || preg_match('/<\s*[a-z][^>]*>/i', $text) !== 1) {
            return $text;
        }
        $text = (string) preg_replace('#<\s*(script|style)\b[^>]*>.*?<\s*/\s*\1\s*>#is', '', $text);
        $text = (string) preg_replace('#<\s*li\b[^>]*>#i', "\n- ", $text);
        $text = (string) preg_replace('#<\s*br\s*/?\s*>#i', "\n", $text);
        $text = (string) preg_replace('#<\s*/\s*(p|div|h[1-6]|ul|ol|tr|table|section|blockquote)\s*>#i', "\n\n", $text);
        $text = html_entity_decode(strip_tags($text), ENT_QUOTES | ENT_HTML5, 'UTF-8');
        $text = (string) preg_replace("/[ \t\x{00A0}]+/u", ' ', $text);
        $text = (string) preg_replace("/ *\n */", "\n", $text);
        $text = (string) preg_replace("/\n{3,}/", "\n\n", $text);

        return trim($text);
    }

    /** One line of plain text (names, SKUs, option values). */
    public static function line(string $cell): string
    {
        return trim((string) preg_replace('/\s+/u', ' ', html_entity_decode(strip_tags($cell), ENT_QUOTES | ENT_HTML5, 'UTF-8')));
    }
}
