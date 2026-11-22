<?php

declare(strict_types=1);

namespace App\Http\Requests\Dashboard;

use App\Http\Requests\ApiRequest;
use App\Rules\TenantExists;

/** The merchant's own carrier key, and optionally the store's shipping company it ships for. */
final class ConnectCarrierRequest extends ApiRequest
{
    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'api_key' => ['required', 'string', 'min:8', 'max:500'],
            'company_id' => ['sometimes', 'nullable', 'integer', TenantExists::table('shipping_companies')],
        ];
    }
}
