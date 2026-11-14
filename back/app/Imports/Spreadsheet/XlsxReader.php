<?php

declare(strict_types=1);

namespace App\Imports\Spreadsheet;

use Generator;
use XMLReader;
use ZipArchive;

/**
 * Reads the first worksheet of an .xlsx file row by row (ZipArchive + XMLReader, no library),
 * so a sheet with thousands of products never sits in memory as a whole. Values come back as
 * trimmed strings, cells placed by their column letter (empty cells in the middle stay empty).
 */
final class XlsxReader
{
    /** @return Generator<int, list<string>> */
    public function rows(string $path): Generator
    {
        $zip = new ZipArchive;
        if ($zip->open($path) !== true) {
            throw new UnreadableFile('not_xlsx');
        }

        try {
            $sheet = $this->firstSheetPath($zip);
            $shared = $this->sharedStrings($zip);
            $exists = $zip->locateName($sheet) !== false;
        } finally {
            $zip->close();
        }
        if (! $exists) {
            throw new UnreadableFile('not_xlsx');
        }

        // Streamed straight out of the zip: the sheet XML is never loaded whole.
        $reader = new XMLReader;
        if (! @$reader->open('zip://'.$path.'#'.$sheet, null, LIBXML_NONET | LIBXML_COMPACT)) {
            throw new UnreadableFile('not_xlsx');
        }

        $row = null;
        $col = 0;
        $type = '';
        $value = null;
        while (@$reader->read()) {
            if ($reader->nodeType === XMLReader::ELEMENT) {
                switch ($reader->localName) {
                    case 'row':
                        $row = [];
                        $col = 0;
                        if ($reader->isEmptyElement) {
                            yield [];
                            $row = null;
                        }
                        break;
                    case 'c':
                        $ref = (string) $reader->getAttribute('r');
                        $col = $ref !== '' ? self::columnIndex($ref) : $col;
                        $type = (string) $reader->getAttribute('t');
                        $value = null;
                        if ($reader->isEmptyElement) {
                            $col++;
                        }
                        break;
                    case 'v':
                        $value = $reader->readString();
                        break;
                    case 'is':
                        // Inline string: all its <t> runs.
                        $value = (string) preg_replace('/\s+$/u', '', $this->innerText($reader->readOuterXml()));
                        break;
                }
            } elseif ($reader->nodeType === XMLReader::END_ELEMENT) {
                if ($reader->localName === 'c' && $row !== null) {
                    $text = match ($type) {
                        's' => $shared[(int) $value] ?? '',
                        'b' => $value === '1' ? 'TRUE' : 'FALSE',
                        default => self::number((string) $value),
                    };
                    $row[$col] = trim($text);
                    $col++;
                } elseif ($reader->localName === 'row' && $row !== null) {
                    yield self::fill($row);
                    $row = null;
                }
            }
        }
        $reader->close();
    }

    /** "C12" → 2 (0-based). */
    public static function columnIndex(string $ref): int
    {
        $letters = (string) preg_replace('/\d+/', '', strtoupper($ref));
        $n = 0;
        foreach (str_split($letters) as $ch) {
            $n = $n * 26 + (ord($ch) - 64);
        }

        return max(0, $n - 1);
    }

    /** Excel stores 1250.5 as "1250.5" and big ids as "1.23456789E+12": give the digits back. */
    private static function number(string $raw): string
    {
        if ($raw !== '' && preg_match('/^-?\d+(\.\d+)?E[+-]?\d+$/i', $raw) === 1) {
            $f = (float) $raw;
            if (abs($f) < 1e15 && floor($f) === $f) {
                return number_format($f, 0, '.', '');
            }
        }
        if (preg_match('/^-?\d+\.\d{6,}$/', $raw) === 1) {
            // Floating noise like 199.99000000000001.
            return rtrim(rtrim(number_format((float) $raw, 4, '.', ''), '0'), '.');
        }

        return $raw;
    }

    /** @param array<int, string> $cells @return list<string> */
    private static function fill(array $cells): array
    {
        if ($cells === []) {
            return [];
        }
        $out = array_fill(0, max(array_keys($cells)) + 1, '');
        foreach ($cells as $i => $v) {
            $out[$i] = $v;
        }

        return $out;
    }

    private function firstSheetPath(ZipArchive $zip): string
    {
        $workbook = $zip->getFromName('xl/workbook.xml');
        $rels = $zip->getFromName('xl/_rels/workbook.xml.rels');
        if ($workbook === false) {
            throw new UnreadableFile('not_xlsx');
        }
        if ($rels !== false && preg_match('/<(?:\w+:)?sheet[^>]*r:id="([^"]+)"/', $workbook, $m) === 1) {
            preg_match_all('/<Relationship[^>]*>/', $rels, $tags);
            foreach ($tags[0] as $tag) {
                if (preg_match('/Id="([^"]+)"/', $tag, $id) === 1 && $id[1] === $m[1] && preg_match('/Target="([^"]+)"/', $tag, $target) === 1) {
                    $path = ltrim($target[1], '/');

                    return str_starts_with($path, 'xl/') ? $path : 'xl/'.$path;
                }
            }
        }

        return 'xl/worksheets/sheet1.xml';
    }

    /** @return list<string> */
    private function sharedStrings(ZipArchive $zip): array
    {
        $xml = $zip->getFromName('xl/sharedStrings.xml');
        if ($xml === false) {
            return [];
        }
        $reader = new XMLReader;
        $reader->XML($xml, null, LIBXML_NONET | LIBXML_COMPACT);
        $strings = [];
        while (@$reader->read()) {
            if ($reader->nodeType === XMLReader::ELEMENT && $reader->localName === 'si') {
                $strings[] = $this->innerText($reader->readOuterXml());
            }
        }
        $reader->close();

        return $strings;
    }

    /** Text of every <t> in a string item, skipping phonetic runs (<rPh>). */
    private function innerText(string $xml): string
    {
        $xml = (string) preg_replace('#<(?:\w+:)?rPh\b.*?</(?:\w+:)?rPh>#s', '', $xml);
        preg_match_all('#<(?:\w+:)?t(?:\s[^>]*)?>(.*?)</(?:\w+:)?t>#s', $xml, $m);

        return html_entity_decode(implode('', $m[1]), ENT_QUOTES | ENT_XML1, 'UTF-8');
    }
}
