<?php

declare(strict_types=1);

namespace App\Http\Requests\Dashboard;

use App\Http\Requests\ApiRequest;
use App\Imports\Products\ImportFiles;

/** The sheet to import (.xlsx or .csv; the type is checked again when it is read). */
final class ProductImportUploadRequest extends ApiRequest
{
    /** @return array<string, mixed> */
    public function rules(): array
    {
        return ['file' => ['required', 'file', 'max:'.ImportFiles::MAX_KB]];
    }
}
