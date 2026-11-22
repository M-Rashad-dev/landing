<?php

declare(strict_types=1);

namespace App\Http\Requests\Dashboard;

use App\Http\Requests\ApiRequest;
use App\Shipping\ShipOrder;
use App\Support\Money;

/** Shipping one order: which connected carrier, and what the merchant changed in the dialog (EGP for cod). */
final class ShipOrderRequest extends ApiRequest
{
    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'carrier' => ['required', 'string', 'max:30'],
            'district_id' => ['sometimes', 'nullable', 'string', 'max:80'],
            'cod' => ['sometimes', 'nullable', 'numeric', 'min:0', 'max:'.(ShipOrder::MAX_COD / 100)],
            'items_count' => ['sometimes', 'nullable', 'integer', 'min:1', 'max:999'],
            'notes' => ['sometimes', 'nullable', 'string', 'max:200'],
            'allow_open' => ['sometimes', 'nullable', 'boolean'],
        ];
    }

    /** @return array{district_id?: string|null, cod?: int|null, items_count?: int|null, notes?: string|null, allow_open?: bool|null} */
    public function shipInput(): array
    {
        $data = $this->validated();
        $cod = $data['cod'] ?? null;

        return array_filter([
            'district_id' => $data['district_id'] ?? null,
            'cod' => $cod === null ? null : Money::toCents((string) $cod),
            'items_count' => isset($data['items_count']) ? (int) $data['items_count'] : null,
            'notes' => $data['notes'] ?? null,
            'allow_open' => isset($data['allow_open']) ? (bool) $data['allow_open'] : null,
        ], fn ($v) => $v !== null);
    }
}
