<?php

declare(strict_types=1);

namespace App\Http\Requests\Dashboard;

use App\Http\Requests\ApiRequest;

/**
 * Only a first-pass check here; MediaProcessor re-validates the real bytes.
 */
final class UploadMediaRequest extends ApiRequest
{
    /** @return array<string, mixed> */
    public function rules(): array
    {
        $purpose = (string) $this->input('purpose', 'general');
        $max = $purpose === 'audio' ? 1 : (int) config('landing.limits.upload_files_per_request');
        $maxKb = $purpose === 'audio' ? 10 * 1024 : (int) config('landing.limits.upload_max_kb');

        return [
            'files' => ['required', 'array', 'min:1', "max:{$max}"],
            'files.*' => ['required', 'file', "max:{$maxKb}"],
            'purpose' => ['sometimes', 'string', 'in:general,favicon,audio'],
        ];
    }

    /** @return array<string, string> */
    public function messages(): array
    {
        $purpose = (string) $this->input('purpose', 'general');
        $maxKb = $purpose === 'audio' ? 10 * 1024 : (int) config('landing.limits.upload_max_kb');
        $sizeKey = $purpose === 'audio' ? 'media.audio_too_large' : 'media.too_large';

        return [
            'files.max' => __('media.too_many_files', ['max' => (int) config('landing.limits.upload_files_per_request')]),
            'files.*.max' => __($sizeKey, ['max' => (int) round($maxKb / 1024)]),
        ];
    }

    /** @return array<string, string> */
    public function attributes(): array
    {
        return array_merge(parent::attributes(), ['files' => 'الصور', 'files.*' => 'الصورة']);
    }
}
