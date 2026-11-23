<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Dashboard;

use App\Http\Controllers\Concerns\RespondsWithJson;
use App\Http\Controllers\Controller;
use App\Models\OrderConfirmationSetting;
use App\Orders\WhatsAppConfirmations;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/** «تأكيد الطلبات على واتساب»: on / off, the timings, and how it went in the last 30 days. */
final class OrderConfirmationController extends Controller
{
    use RespondsWithJson;

    public function __construct(private readonly WhatsAppConfirmations $confirmations) {}

    public function show(): JsonResponse
    {
        return $this->ok($this->state());
    }

    public function update(Request $request): JsonResponse
    {
        $data = $request->validate([
            'enabled' => ['required', 'boolean'],
            'delay_minutes' => ['required', 'integer', 'between:0,1440'],
            'reminder_hours' => ['nullable', 'integer', 'between:1,47'],
            'final_hours' => ['required', 'integer', 'between:2,72'],
            'on_timeout' => ['required', Rule::in(['keep', 'cancel'])],
        ]);
        if (isset($data['reminder_hours']) && $data['reminder_hours'] >= $data['final_hours']) {
            $data['reminder_hours'] = null;
        }
        OrderConfirmationSetting::current()->fill($data)->save();

        return $this->ok($this->state());
    }

    /** @return array<string, mixed> */
    private function state(): array
    {
        $s = OrderConfirmationSetting::current();

        return [
            // WhatsApp keys set and the confirmation template approved by Meta.
            'available' => $this->confirmations->available(),
            'enabled' => $s->enabled,
            'delay_minutes' => $s->delay_minutes,
            'reminder_hours' => $s->reminder_hours,
            'final_hours' => $s->final_hours,
            'on_timeout' => $s->on_timeout,
            'stats' => $this->confirmations->stats(),
        ];
    }
}
