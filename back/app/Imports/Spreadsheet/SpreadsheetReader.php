<?php

declare(strict_types=1);

namespace App\Imports\Spreadsheet;

use Generator;

/**
 * One way to read an uploaded sheet (.xlsx or .csv): the header row is the first row that has at
 * least two filled cells (titles or notes above it are skipped), then the data rows, each with its
 * line number in the file so problems can point at the exact row.
 */
final class SpreadsheetReader
{
    public const EXTENSIONS = ['xlsx', 'csv', 'txt'];

    /** Rows scanned to find the header row. */
    private const HEADER_SCAN = 15;

    public function __construct(private readonly XlsxReader $xlsx, private readonly CsvReader $csv) {}

    /** @return Generator<int, list<string>> 1-based file line → cells */
    public function raw(string $path, string $extension): Generator
    {
        $rows = strtolower($extension) === 'xlsx' ? $this->xlsx->rows($path) : $this->csv->rows($path);
        $line = 0;
        foreach ($rows as $row) {
            $line++;
            yield $line => $row;
        }
    }

    /**
     * The header row and a generator of data rows (line → cells), skipping fully empty rows.
     *
     * @return array{headers: list<string>, header_line: int, rows: Generator<int, list<string>>}
     */
    public function open(string $path, string $extension): array
    {
        $raw = $this->raw($path, $extension);
        $headers = null;
        $headerLine = 0;
        while ($raw->valid()) {
            $cells = $raw->current();
            $line = (int) $raw->key();
            $raw->next();
            if (count(array_filter($cells, fn ($c) => $c !== '')) >= 2) {
                $headers = $cells;
                $headerLine = $line;
                break;
            }
            if ($line >= self::HEADER_SCAN) {
                break;
            }
        }
        if ($headers === null) {
            throw new UnreadableFile('no_header');
        }

        $headers = array_map(fn ($h) => trim((string) preg_replace('/\s+/u', ' ', $h)), $headers);
        $width = count($headers);

        $rows = (function () use ($raw, $width): Generator {
            while ($raw->valid()) {
                $cells = $raw->current();
                $line = (int) $raw->key();
                $raw->next();
                if (count(array_filter($cells, fn ($c) => $c !== '')) === 0) {
                    continue;
                }
                yield $line => array_pad(array_slice($cells, 0, max($width, count($cells))), $width, '');
            }
        })();

        return ['headers' => $headers, 'header_line' => $headerLine, 'rows' => $rows];
    }
}
