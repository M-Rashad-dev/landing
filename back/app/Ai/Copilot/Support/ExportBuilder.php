<?php

declare(strict_types=1);

namespace App\Ai\Copilot\Support;

use App\Ai\Copilot\CopilotCatalog;
use App\Ai\Copilot\CopilotContext;
use App\Imports\Spreadsheet\XlsxWriter;
use App\Models\CopilotExport;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

/**
 * Builds the Excel file of a resource list or a report on the server (docs/plans/ai-copilot.md §3.4 `export_xlsx`):
 * the merchant's full data (personal data included: it never passes through the model), right-to-left, every cell
 * written as text (no formula can run). Kept 24 hours, downloadable by its token by this store only.
 */
final class ExportBuilder
{
    public const MAX_ROWS = 20_000;

    public const DISK = 'local';

    public function __construct(private readonly CopilotCatalog $catalog, private readonly XlsxWriter $writer) {}

    /**
     * @param  array{resource?: string, filters?: array<string, mixed>, sort?: string|null, report?: string, params?: array<string, mixed>}  $source
     */
    public function build(array $source, ?string $filename, CopilotContext $ctx): CopilotExport
    {
        if (isset($source['resource'])) {
            [$title, $headers, $rows, $count] = $this->resourceRows($source, $ctx);
        } elseif (isset($source['report'])) {
            [$title, $headers, $rows, $count] = $this->reportRows($source, $ctx);
        } else {
            throw new CopilotToolError('source needs a resource (with filters) or a report (with params).');
        }

        $token = Str::random(48);
        $path = "copilot/exports/{$ctx->tenant->id}/{$token}.xlsx";
        $disk = Storage::disk(self::DISK);
        $disk->makeDirectory(dirname($path));
        $this->writer->write($disk->path($path), $title, $headers, $rows, array_fill(0, count($headers), 18));

        return CopilotExport::query()->create([
            'user_id' => $ctx->user?->id,
            'chat_id' => $ctx->chat?->id,
            'token' => $token,
            'filename' => self::filename($filename ?: $title),
            'path' => $path,
            'rows_count' => $count,
            'expires_at' => now()->addHours(CopilotExport::HOURS),
        ]);
    }

    /** The block the chat shows for a file. */
    public static function block(CopilotExport $export): array
    {
        return ['type' => 'export', 'token' => $export->token, 'filename' => $export->filename, 'rows' => $export->rows_count];
    }

    /**
     * @param  array<string, mixed>  $source
     * @return array{0: string, 1: list<string>, 2: iterable<list<string|int|float|null>>, 3: int}
     */
    private function resourceRows(array $source, CopilotContext $ctx): array
    {
        $resource = $this->catalog->resource((string) $source['resource'], $ctx);
        if ($resource === null) {
            throw new CopilotToolError("Unknown resource «{$source['resource']}».");
        }
        $query = RecordQuery::build($resource, (array) ($source['filters'] ?? []), isset($source['sort']) ? (string) $source['sort'] : null, $ctx);
        $count = (clone $query)->toBase()->getCountForPagination();
        if ($count > self::MAX_ROWS) {
            throw new CopilotToolError("That is {$count} rows; a file holds at most ".self::MAX_ROWS.'. Narrow the filters (a shorter period, a status…).');
        }
        $fields = array_values(array_filter($resource->fields(), fn ($f) => $f->inTable));
        $headers = ['#', ...array_map(fn ($f) => $f->label, $fields)];
        $rows = (function () use ($query, $resource, $fields) {
            foreach ($query->with($resource->with())->lazy(500) as $row) {
                /** @var Model $row */
                yield [(string) $row->getKey(), ...array_map(fn ($f) => $resource->cell($row, $f), $fields)];
            }
        })();

        return [$resource->label(), $headers, $rows, $count];
    }

    /**
     * @param  array<string, mixed>  $source
     * @return array{0: string, 1: list<string>, 2: list<list<string|int|float|null>>, 3: int}
     */
    private function reportRows(array $source, CopilotContext $ctx): array
    {
        $report = $this->catalog->report((string) $source['report'], $ctx);
        if ($report === null) {
            throw new CopilotToolError("Unknown report «{$source['report']}».");
        }
        $result = $report->run((array) ($source['params'] ?? []), $ctx);
        if (! $result->hasTable()) {
            throw new CopilotToolError('This report has no table to export.');
        }
        $keys = array_column($result->columns, 'key');
        $rows = array_map(fn (array $r) => array_map(fn (string $k) => isset($r[$k]) && is_scalar($r[$k]) ? $r[$k] : null, $keys), array_slice($result->rows, 0, self::MAX_ROWS));

        return [$result->title !== '' ? $result->title : $report->label(), array_column($result->columns, 'label'), $rows, count($rows)];
    }

    /** A safe file name: letters (Arabic too), digits, spaces and dashes, then the date. */
    private static function filename(string $name): string
    {
        $clean = trim((string) preg_replace('/[^\p{L}\p{N} \-_]+/u', ' ', $name));
        $clean = mb_substr((string) preg_replace('/\s+/u', '-', $clean), 0, 80);

        return ($clean !== '' ? $clean : 'export').'-'.now('Africa/Cairo')->format('Y-m-d').'.xlsx';
    }
}
