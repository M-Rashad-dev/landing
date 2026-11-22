<?php

declare(strict_types=1);

namespace App\Store;

use App\Enums\ProductInputKind;
use App\Models\CustomerUpload;
use App\Models\OrderItem;
use App\Models\ProductInput;
use App\Support\Money;
use App\Tenancy\Tenancy;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * Images and files customers upload on «حسب الطلب» fields. The real type is read from the file (never its name),
 * kept on the private disk under the store's folder, and served only to the store (as a download). An upload
 * waits for its order with a random token; an order claims each token once.
 */
final class CustomerUploads
{
    public const DISK = 'local';

    public const MAX_KB = 10240;

    public const IMAGE_MIMES = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp', 'image/gif' => 'gif', 'image/heic' => 'heic', 'image/heif' => 'heif'];

    public const FILE_MIMES = [
        'application/pdf' => 'pdf',
        'application/msword' => 'doc',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document' => 'docx',
        'application/vnd.ms-excel' => 'xls',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' => 'xlsx',
        'application/vnd.ms-powerpoint' => 'ppt',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation' => 'pptx',
        'text/plain' => 'txt',
        'text/csv' => 'csv',
        'application/zip' => 'zip',
        'application/x-zip-compressed' => 'zip',
        'application/x-rar' => 'rar',
        'application/vnd.rar' => 'rar',
        'application/postscript' => 'ai',
        'image/vnd.adobe.photoshop' => 'psd',
        'application/octet-stream' => 'bin',
    ];

    /**
     * What an order line keeps (order_items.options): the chosen option values, then the «حسب الطلب» fields the
     * customer filled (uploads carry their token until claim() swaps it for the file).
     *
     * @param  list<array{option: string, value: string, price_delta: int}>  $selected
     * @param  list<array{input_id: int, label: string, kind: string, value: string, price_delta: int}>  $inputs
     * @return list<array<string, mixed>>
     */
    public static function lineOptions(array $selected, array $inputs): array
    {
        $options = array_map(fn (array $v) => ['option' => $v['option'], 'value' => $v['value'], 'price_delta' => Money::toFloat($v['price_delta'])], $selected);
        foreach ($inputs as $f) {
            $upload = ProductInputKind::from($f['kind'])->isUpload();
            $options[] = ['option' => $f['label'], 'value' => $upload ? '' : $f['value'], 'price_delta' => Money::toFloat($f['price_delta']), 'input_id' => $f['input_id'], 'kind' => $f['kind'], ...($upload ? ['upload' => $f['value']] : [])];
        }

        return $options;
    }

    /** Token shape (what checkouts send back). */
    public const TOKEN = '/^[a-z0-9]{40}$/';

    /** The allowed types of a field: images only, or images + documents. @return array<string, string> */
    public static function mimes(ProductInputKind $kind): array
    {
        return $kind === ProductInputKind::Image ? self::IMAGE_MIMES : self::IMAGE_MIMES + self::FILE_MIMES;
    }

    /** The problem with a file for this field (translated), or null. */
    public static function problem(UploadedFile $file, ProductInput $input): ?string
    {
        if (! isset(self::mimes($input->kind)[(string) $file->getMimeType()])) {
            return (string) __($input->kind === ProductInputKind::Image ? 'store.upload.image_only' : 'store.upload.file_type');
        }
        if ((int) ceil(((int) $file->getSize()) / 1024) > self::MAX_KB) {
            return (string) __('store.upload.too_big', ['max' => intdiv(self::MAX_KB, 1024)]);
        }

        return null;
    }

    public function store(UploadedFile $file, ProductInput $input): CustomerUpload
    {
        $mime = (string) $file->getMimeType();
        $ext = self::mimes($input->kind)[$mime] ?? 'bin';
        $original = mb_substr(trim(strip_tags($file->getClientOriginalName())) ?: 'file.'.$ext, 0, 200);
        // Keep the customer's own extension for opaque types (a .cdr, .ai… read as octet-stream).
        if ($ext === 'bin' && preg_match('/\.([a-z0-9]{1,8})$/i', $original, $m) === 1) {
            $ext = strtolower($m[1]);
        }
        $token = Str::lower(Str::random(40));
        $path = $file->storeAs('customer-uploads/'.$input->tenant_id.'/'.now()->format('Y-m'), $token.'.'.$ext, self::DISK);

        return CustomerUpload::query()->create([
            'token' => $token,
            'product_input_id' => $input->id,
            'path' => (string) $path,
            'name' => $original,
            'mime' => $mime,
            'size' => (int) $file->getSize(),
        ]);
    }

    /**
     * Claims the uploads of one order line (inside the order's transaction): each token must be an unclaimed upload
     * of that field. Returns the line's options with the file's name as value and its id.
     *
     * @param  list<array<string, mixed>>  $options  the item's options (input entries carry `upload` = token)
     * @return list<array<string, mixed>>
     *
     * @throws ValidationException on {$field}.{input_id}
     */
    public function claim(OrderItem $item, array $options, string $field): array
    {
        foreach ($options as $i => $entry) {
            if (! isset($entry['upload'])) {
                continue;
            }
            $upload = CustomerUpload::query()
                ->where('token', (string) $entry['upload'])
                ->where('product_input_id', (int) $entry['input_id'])
                ->whereNull('order_item_id')
                ->lockForUpdate()
                ->first();
            if ($upload === null) {
                throw ValidationException::withMessages(["{$field}.{$entry['input_id']}" => [__('store.upload.gone')]]);
            }
            $upload->forceFill(['order_item_id' => $item->id])->save();
            unset($entry['upload']);
            $options[$i] = [...$entry, 'value' => $upload->name, 'upload_id' => $upload->id];
        }

        return array_values($options);
    }

    /** Tokens that can still be claimed (the quote before the transaction). @param list<array<string, mixed>> $entries */
    public function assertClaimable(array $entries, string $field): void
    {
        foreach ($entries as $entry) {
            if (! isset($entry['upload'])) {
                continue;
            }
            $ok = CustomerUpload::query()->where('token', (string) $entry['upload'])->where('product_input_id', (int) $entry['input_id'])->whereNull('order_item_id')->exists();
            if (! $ok) {
                throw ValidationException::withMessages(["{$field}.{$entry['input_id']}" => [__('store.upload.gone')]]);
            }
        }
    }

    public function absolutePath(CustomerUpload $upload): string
    {
        return Storage::disk(self::DISK)->path($upload->path);
    }

    /** Uploads no order claimed within a day: file and row. Returns how many went. */
    public function prune(): int
    {
        // Audited bypass: one cleanup across all tenants, only uploads no order took in a day.
        return Tenancy::withoutTenant(function (): int {
            $count = 0;
            CustomerUpload::query()->whereNull('order_item_id')->where('created_at', '<', now()->subDay())
                ->chunkById(200, function ($uploads) use (&$count): void {
                    foreach ($uploads as $upload) {
                        Storage::disk(self::DISK)->delete($upload->path);
                        $upload->delete();
                        $count++;
                    }
                });

            return $count;
        });
    }
}
