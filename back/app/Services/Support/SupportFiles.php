<?php

declare(strict_types=1);

namespace App\Services\Support;

use App\Models\SupportAttachment;
use App\Models\SupportMessage;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

/**
 * Images and videos of the support chat: the real type is read from the file (never its name),
 * kept on the private disk under the store's folder, served only through the API.
 */
final class SupportFiles
{
    public const IMAGE_MIMES = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp', 'image/gif' => 'gif'];

    public const VIDEO_MIMES = ['video/mp4' => 'mp4', 'video/webm' => 'webm', 'video/quicktime' => 'mov'];

    /** The problem with a file (translated), or null when it can be sent. */
    public static function problem(UploadedFile $file): ?string
    {
        $mime = (string) $file->getMimeType();
        $kb = (int) ceil(((int) $file->getSize()) / 1024);
        if (isset(self::IMAGE_MIMES[$mime])) {
            $max = (int) config('landing.support.image_max_kb');

            return $kb > $max ? __('support.image_size', ['max' => intdiv($max, 1024)]) : null;
        }
        if (isset(self::VIDEO_MIMES[$mime])) {
            $max = (int) config('landing.support.video_max_kb');

            return $kb > $max ? __('support.video_size', ['max' => intdiv($max, 1024)]) : null;
        }

        return __('support.file_type');
    }

    /** @param list<UploadedFile> $files */
    public function store(SupportMessage $message, array $files): void
    {
        foreach ($files as $file) {
            $mime = (string) $file->getMimeType();
            $kind = isset(self::IMAGE_MIMES[$mime]) ? 'image' : 'video';
            $ext = self::IMAGE_MIMES[$mime] ?? self::VIDEO_MIMES[$mime];
            $path = $file->storeAs('support/'.$message->tenant_id.'/'.$message->support_ticket_id, Str::ulid()->toBase32().'.'.$ext, 'local');
            SupportAttachment::query()->create([
                'support_ticket_id' => $message->support_ticket_id,
                'support_message_id' => $message->id,
                'kind' => $kind,
                'path' => (string) $path,
                'name' => mb_substr(trim(strip_tags($file->getClientOriginalName())) ?: 'file.'.$ext, 0, 200),
                'mime' => $mime,
                'size' => (int) $file->getSize(),
            ]);
        }
    }

    public function absolutePath(SupportAttachment $attachment): string
    {
        return Storage::disk('local')->path($attachment->path);
    }
}
