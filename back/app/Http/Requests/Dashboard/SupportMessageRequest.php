<?php

declare(strict_types=1);

namespace App\Http\Requests\Dashboard;

use App\Http\Requests\ApiRequest;
use App\Services\Support\SupportFiles;
use Illuminate\Http\UploadedFile;
use Illuminate\Validation\Validator;

/** A support message: text and / or up to 5 images or videos (types read from the files themselves). */
class SupportMessageRequest extends ApiRequest
{
    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'body' => ['nullable', 'string', 'max:5000'],
            'files' => ['sometimes', 'array', 'max:'.(int) config('landing.support.max_files')],
            'files.*' => ['file'],
        ];
    }

    public function after(): array
    {
        return [function (Validator $validator): void {
            foreach ($this->uploads() as $i => $file) {
                $problem = SupportFiles::problem($file);
                if ($problem !== null) {
                    $validator->errors()->add("files.{$i}", $problem);
                }
            }
        }];
    }

    /** @return list<UploadedFile> */
    public function uploads(): array
    {
        $files = $this->file('files', []);

        return array_values(array_filter(is_array($files) ? $files : [$files], fn ($f) => $f instanceof UploadedFile));
    }

    public function body(): ?string
    {
        $body = $this->input('body');

        return is_string($body) ? $body : null;
    }
}
