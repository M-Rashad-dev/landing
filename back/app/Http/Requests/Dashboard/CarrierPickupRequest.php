<?php

declare(strict_types=1);

namespace App\Http\Requests\Dashboard;

use App\Http\Requests\ApiRequest;
use App\Support\CairoTime;

/** A courier visit: the day (today to two weeks ahead, Cairo time) and how many parcels. */
final class CarrierPickupRequest extends ApiRequest
{
    /** @return array<string, mixed> */
    public function rules(): array
    {
        $today = now(CairoTime::ZONE)->toDateString();

        return [
            'date' => ['required', 'date_format:Y-m-d', 'after_or_equal:'.$today, 'before_or_equal:'.now(CairoTime::ZONE)->addDays(14)->toDateString()],
            'parcels' => ['required', 'integer', 'min:1', 'max:500'],
            'notes' => ['sometimes', 'nullable', 'string', 'max:200'],
        ];
    }
}
