<?php

declare(strict_types=1);

namespace App\Http\Requests\Dashboard;

use App\Http\Requests\ApiRequest;
use App\Rules\CairoDateTime;
use App\Rules\EgyptPhone;
use App\Rules\TenantExists;
use App\Services\PhoneNormalizer;

final class PricingPreviewRequest extends ApiRequest
{
    protected function prepareForValidation(): void
    {
        if (is_string($this->input('phone')) && trim($this->input('phone')) !== '') {
            $this->merge(['phone' => app(PhoneNormalizer::class)->normalize($this->input('phone')) ?? $this->input('phone')]);
        }
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'product_id' => ['required', 'integer', TenantExists::table('products')->ignoreTrashed()],
            'quantity' => ['required', 'integer'],
            'options' => ['sometimes', 'array'],
            'options.*' => ['nullable', 'integer'],
            'code' => ['nullable', 'string', 'max:30'],
            'phone' => ['nullable', 'string', new EgyptPhone],
            'at' => ['nullable', new CairoDateTime],
        ];
    }
}
