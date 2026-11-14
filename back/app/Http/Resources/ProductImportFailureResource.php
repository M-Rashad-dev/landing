<?php

declare(strict_types=1);

namespace App\Http\Resources;

use App\Models\ProductImportFailure;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin ProductImportFailure */
final class ProductImportFailureResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'row_number' => $this->row_number,
            'identifier' => $this->identifier,
            'name' => $this->name,
            'reasons' => $this->reasons,
        ];
    }
}
