<?php

declare(strict_types=1);

namespace App\Http\Requests\Dashboard;

use App\Http\Requests\ApiRequest;

/** A connected carrier's settings (pickup location, package, airway bill size, open package, auto-ship). */
final class CarrierSettingsRequest extends ApiRequest
{
    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'location_id' => ['sometimes', 'nullable', 'string', 'max:80'],
            'allow_open' => ['sometimes', 'boolean'],
            'package_type' => ['sometimes', 'string', 'in:Parcel,Document,Light Bulky,Heavy Bulky'],
            'size' => ['sometimes', 'string', 'in:SMALL,MEDIUM,LARGE'],
            'label_size' => ['sometimes', 'string', 'in:A4,A6'],
            'auto_ship' => ['sometimes', 'boolean'],
            'notes' => ['sometimes', 'nullable', 'string', 'max:200'],
        ];
    }
}
