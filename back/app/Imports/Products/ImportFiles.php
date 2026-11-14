<?php

declare(strict_types=1);

namespace App\Imports\Products;

use App\Billing\Entitlements;
use App\Billing\UsageCounter;
use App\Enums\ImportStatus;
use App\Enums\PlanLimit;
use App\Exceptions\ApiException;
use App\Imports\Spreadsheet\SpreadsheetReader;
use App\Imports\Spreadsheet\UnreadableFile;
use App\Imports\Spreadsheet\XlsxWriter;
use App\Models\ProductImport;
use App\Models\ProductImportFailure;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

/**
 * The files of the import feature: the upload (kept privately until the import ends, read once to
 * show its columns, a few sample rows and our mapping guess), the ready template, and the sheet of
 * products that failed (their original cells plus why, to fix and upload again).
 */
final class ImportFiles
{
    public const MAX_KB = 8 * 1024;

    public const MAX_ROWS = 20000;

    private const SAMPLES = 5;

    public function __construct(
        private readonly SpreadsheetReader $reader,
        private readonly ColumnMapper $mapper,
        private readonly Entitlements $entitlements,
        private readonly UsageCounter $usage,
    ) {}

    public function upload(UploadedFile $file, ?int $userId): ProductImport
    {
        $extension = strtolower($file->getClientOriginalExtension());
        if ($extension === 'xls') {
            throw self::invalid(__('imports.xls'));
        }
        if (! in_array($extension, SpreadsheetReader::EXTENSIONS, true)) {
            throw self::invalid(__('imports.unreadable'));
        }

        $path = $file->storeAs('imports', Str::uuid()->toString().'.'.($extension === 'txt' ? 'csv' : $extension), 'local');
        if ($path === false) {
            throw self::invalid(__('imports.unreadable'));
        }
        $full = Storage::disk('local')->path($path);

        try {
            $sheet = $this->reader->open($full, $extension);
            $samples = [];
            $count = 0;
            foreach ($sheet['rows'] as $cells) {
                if (++$count <= self::SAMPLES) {
                    $samples[] = array_map(fn ($v) => mb_substr($v, 0, 200), $cells);
                }
                if ($count > self::MAX_ROWS) {
                    throw self::invalid(__('imports.too_many_rows', ['max' => number_format(self::MAX_ROWS)]));
                }
            }
            if ($count === 0) {
                throw self::invalid(__('imports.no_rows'));
            }
        } catch (UnreadableFile $e) {
            Storage::disk('local')->delete($path);

            throw self::invalid(__('imports.'.$e->getMessage()));
        } catch (ApiException $e) {
            Storage::disk('local')->delete($path);

            throw $e;
        }

        $headers = array_map(fn ($h) => mb_substr($h, 0, 120), $sheet['headers']);
        $source = $this->mapper->detectSource($headers);

        return ProductImport::query()->create([
            'user_id' => $userId,
            'status' => ImportStatus::Uploaded,
            'source' => $source,
            'file_name' => mb_substr($file->getClientOriginalName(), 0, 200),
            'file_path' => $path,
            'extension' => $extension === 'txt' ? 'csv' : $extension,
            'file_size' => (int) $file->getSize(),
            'headers' => $headers,
            'header_line' => $sheet['header_line'],
            'mapping' => $this->mapper->guess($headers, $source),
            'options' => ['samples' => $samples],
            'total_rows' => $count,
        ]);
    }

    /** How many more products the plan takes (null = no limit worth showing). */
    public function room(): ?int
    {
        $max = $this->entitlements->current()->limit(PlanLimit::Products);

        return max(0, $max - $this->usage->used(PlanLimit::Products));
    }

    /** The ready template: our column names and example products (simple, with variants, hidden). */
    public function template(): string
    {
        $path = tempnam(sys_get_temp_dir(), 'tpl').'.xlsx';
        $headers = ['كود التجميع', 'اسم المنتج', 'السعر', 'السعر قبل الخصم', 'SKU', 'الكمية', 'الوصف', 'وصف مختصر', 'التصنيف', 'الصور', 'اسم الخيار 1', 'قيمة الخيار 1', 'اسم الخيار 2', 'قيمة الخيار 2', 'الحالة'];
        $rows = [
            ['', 'تيشيرت قطن أساسي', '250', '300', 'TS-001', '40', 'تيشيرت قطن 100% مريح للاستخدام اليومي.', 'خامة قطن ناعمة', 'ملابس > رجالي', 'https://example.com/tshirt-1.jpg, https://example.com/tshirt-2.jpg', '', '', '', '', 'ظاهر'],
            ['HOODIE-1', 'هودي شتوي مبطن', '450', '550', 'HD-S-BLK', '10', 'هودي قطن مبطن من جوه، مناسب للشتا.', '', 'ملابس > شتوي', 'https://example.com/hoodie.jpg', 'المقاس', 'S', 'اللون', 'أسود', 'ظاهر'],
            ['HOODIE-1', '', '450', '', 'HD-M-BLK', '15', '', '', '', '', 'المقاس', 'M', 'اللون', 'أسود', ''],
            ['HOODIE-1', '', '480', '', 'HD-L-BLK', '0', '', '', '', '', 'المقاس', 'L', 'اللون', 'أسود', ''],
            ['', 'مج سيراميك', '120', '', 'MUG-01', '', 'مج سيراميك 350 مل.', '', 'مطبخ', '', '', '', '', '', 'مخفي'],
        ];
        app(XlsxWriter::class)->write($path, 'المنتجات', $headers, $rows, [1 => 28, 6 => 40, 8 => 20, 9 => 45]);

        return $path;
    }

    /** The products that failed: the original columns, then the row number and the reasons. */
    public function failures(ProductImport $import): string
    {
        $path = tempnam(sys_get_temp_dir(), 'fail').'.xlsx';
        $headers = [...$import->headers, __('imports.row_column'), __('imports.reason_column')];
        $width = count($import->headers);
        $rows = (function () use ($import, $width) {
            // Created in file order, so id order is row order.
            foreach (ProductImportFailure::query()->where('product_import_id', $import->id)->orderBy('id')->lazy(200) as $failure) {
                foreach (array_values($failure->cells) as $i => $cells) {
                    $cells = array_pad(array_slice($cells, 0, $width), $width, '');
                    yield [...$cells, $i === 0 ? (string) $failure->row_number : '', $i === 0 ? implode(' • ', $failure->reasons) : ''];
                }
            }
        })();
        app(XlsxWriter::class)->write($path, __('imports.failures_sheet'), $headers, $rows, [$width => 10, $width + 1 => 50], [$width + 1]);

        return $path;
    }

    private static function invalid(string $message): ApiException
    {
        return new ApiException(422, 'validation_failed', $message, ['file' => [$message]]);
    }
}
