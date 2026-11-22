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
            'sender_name' => ['sometimes', 'nullable', 'string', 'max:50'],
            'sender_phone' => ['sometimes', 'nullable', 'string', 'regex:/^01[0125][0-9]{8}$/'],
            'sender_governorate' => ['sometimes', 'nullable', 'string', 'in:'.implode(',', (array) config('landing.governorates'))],
            'sender_area' => ['sometimes', 'nullable', 'string', 'max:130'],
            'sender_street' => ['sometimes', 'nullable', 'string', 'max:200'],
            'weight' => ['sometimes', 'numeric', 'min:0.01', 'max:30'],
            'goods_type' => ['sometimes', 'string', 'in:ITN1,ITN2,ITN3,ITN5,ITN6,ITN7,ITN8,ITN9,ITN10,ITN11,ITN12,ITN13,ITN14,ITN15,ITN16'],
            'service_type' => ['sometimes', 'string', 'in:01,02'],
        ];
    }
}
