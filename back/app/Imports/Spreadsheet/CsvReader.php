<?php

declare(strict_types=1);

namespace App\Imports\Spreadsheet;

use Generator;

/**
 * Reads a CSV row by row. Handles what real exports throw at us: a UTF-8 BOM, UTF-16 files
 * (Excel "Unicode text"), Arabic saved by Excel in Windows-1256, and ";" or tab separators.
 */
final class CsvReader
{
    /** @return Generator<int, list<string>> */
    public function rows(string $path): Generator
    {
        $head = (string) file_get_contents($path, false, null, 0, 64 * 1024);
        [$encoding, $skip] = $this->encoding($head);

        $handle = $this->open($path, $encoding, $skip);
        $delimiter = $this->delimiter($this->firstLine($head, $encoding, $skip));

        try {
            while (($row = fgetcsv($handle, null, $delimiter, '"', '')) !== false) {
                if ($row === [null]) {
                    yield [];

                    continue;
                }
                yield array_map(fn ($v) => trim((string) $v), $row);
            }
        } finally {
            fclose($handle);
        }
    }

    /** @return array{0: string, 1: int} encoding and BOM bytes to skip */
    private function encoding(string $head): array
    {
        if (str_starts_with($head, "\xEF\xBB\xBF")) {
            return ['UTF-8', 3];
        }
        if (str_starts_with($head, "\xFF\xFE")) {
            return ['UTF-16LE', 2];
        }
        if (str_starts_with($head, "\xFE\xFF")) {
            return ['UTF-16BE', 2];
        }
        if (mb_check_encoding($head, 'UTF-8') || mb_check_encoding(mb_substr($head, 0, -2, '8bit'), 'UTF-8')) {
            return ['UTF-8', 0];
        }

        // Not UTF-8: Excel on an Arabic Windows saves CSV as Windows-1256.
        return ['Windows-1256', 0];
    }

    /** @return resource */
    private function open(string $path, string $encoding, int $skip)
    {
        $handle = fopen($path, 'rb');
        if ($handle === false) {
            throw new UnreadableFile('unreadable');
        }
        if ($skip > 0) {
            fread($handle, $skip);
        }
        if ($encoding === 'UTF-8') {
            return $handle;
        }

        // Re-encode into a temporary stream (exports are a few MB at most).
        $out = fopen('php://temp/maxmemory:'.(8 * 1024 * 1024), 'w+b');
        if ($out === false) {
            throw new UnreadableFile('unreadable');
        }
        $converted = self::toUtf8((string) stream_get_contents($handle), $encoding);
        fclose($handle);
        fwrite($out, $converted);
        rewind($out);

        return $out;
    }

    private function firstLine(string $head, string $encoding, int $skip): string
    {
        $text = substr($head, $skip);
        if ($encoding !== 'UTF-8') {
            $text = self::toUtf8($text, $encoding);
        }

        return strtok($text, "\n") ?: '';
    }

    /** mbstring has no Windows-1256: iconv handles it (and UTF-16). */
    private static function toUtf8(string $text, string $encoding): string
    {
        $out = @iconv($encoding === 'Windows-1256' ? 'CP1256' : $encoding, 'UTF-8//IGNORE', $text);

        return $out === false ? (string) mb_convert_encoding($text, 'UTF-8', $encoding === 'Windows-1256' ? 'ISO-8859-6' : $encoding) : $out;
    }

    private function delimiter(string $line): string
    {
        // Count separators outside quotes; the most frequent wins.
        $line = (string) preg_replace('/"[^"]*"/', '', $line);
        $counts = [',' => substr_count($line, ','), ';' => substr_count($line, ';'), "\t" => substr_count($line, "\t")];
        arsort($counts);

        return (string) array_key_first($counts);
    }
}
