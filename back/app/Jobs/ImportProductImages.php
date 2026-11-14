<?php

declare(strict_types=1);

namespace App\Jobs;

use App\Actions\Media\UploadMedia;
use App\Imports\Products\ImageFetcher;
use App\Models\Product;
use App\Models\ProductImport;
use App\Tenancy\Tenancy;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\DB;
use Throwable;

/**
 * Downloads the images of one imported product into the store's media library and attaches them
 * in order (the first is the main image). A link that fails is counted on the import, never fatal.
 */
final class ImportProductImages implements ShouldQueue
{
    use Queueable;

    public int $tries = 1;

    public int $timeout = 300;

    /** @param list<string> $urls */
    public function __construct(
        public readonly int $tenantId,
        public readonly int $importId,
        public readonly int $productId,
        public readonly array $urls,
        public readonly bool $replace,
    ) {}

    public function handle(ImageFetcher $fetcher, UploadMedia $upload): void
    {
        Tenancy::runAs($this->tenantId, function () use ($fetcher, $upload): void {
            $product = Product::query()->find($this->productId);
            $done = 0;
            $mediaIds = [];
            foreach ($this->urls as $url) {
                if ($product === null) {
                    break;
                }
                $file = $fetcher->fetch($url);
                if ($file === null) {
                    continue;
                }
                try {
                    $mediaIds[] = $upload->handle([$file], 'general')[0]->id;
                    $done++;
                } catch (Throwable) {
                    // Not an image, too big, or the plan storage is full: counted as failed below.
                } finally {
                    @unlink($file->getPathname());
                }
            }

            if ($product !== null && $mediaIds !== []) {
                $this->attach($product, $mediaIds);
            }
            $this->count($done, count($this->urls) - $done);
        });
    }

    /** Adds to the import's image counters; the last image of a finished import refreshes the store once. */
    private function count(int $done, int $failed): void
    {
        ProductImport::query()->whereKey($this->importId)->update([
            'images_done' => DB::raw('images_done + '.$done),
            'images_failed' => DB::raw('images_failed + '.$failed),
        ]);
        $import = ProductImport::query()->find($this->importId);
        if ($import !== null && $import->status->isFinished() && $import->images_done + $import->images_failed >= $import->images_total) {
            RevalidateTenantHosts::dispatch($this->tenantId);
        }
    }

    /** @param list<int> $mediaIds */
    private function attach(Product $product, array $mediaIds): void
    {
        DB::transaction(function () use ($product, $mediaIds): void {
            if ($this->replace) {
                DB::table('product_media')->where('product_id', $product->id)->delete();
            }
            $position = (int) DB::table('product_media')->where('product_id', $product->id)->max('position') + ($this->replace ? 0 : 1);
            $now = now();
            $rows = [];
            foreach ($mediaIds as $i => $id) {
                $rows[] = ['tenant_id' => $product->tenant_id, 'product_id' => $product->id, 'media_id' => $id, 'position' => $position + $i, 'created_at' => $now, 'updated_at' => $now];
            }
            DB::table('product_media')->insert($rows);
        });
    }

    public function failed(?Throwable $e): void
    {
        Tenancy::runAs($this->tenantId, fn () => $this->count(0, count($this->urls)));
    }
}
