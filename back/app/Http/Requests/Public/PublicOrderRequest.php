<?php

declare(strict_types=1);

namespace App\Http\Requests\Public;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Shape only; the field rules come from the published order form (App\Support\OrderForm).
 * ip / user_agent are trusted because only Next (with the internal key) can call this.
 */
final class PublicOrderRequest extends FormRequest
{
    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'host' => ['required', 'string', 'max:253'],
            'slug' => ['present', 'nullable', 'string', 'max:100'],
            'quantity' => ['required', 'integer', 'between:1,20'],
            'options' => ['nullable', 'array', 'max:20'],
            'options.*' => ['nullable', 'integer'],
            // «حسب الطلب»: input id → text, or an upload token.
            'inputs' => ['nullable', 'array', 'max:5'],
            'inputs.*' => ['nullable', 'string', 'max:1000'],
            'code' => ['nullable', 'string', 'max:30'],
            'customer' => ['required', 'array'],
            'answers' => ['nullable', 'array', 'max:50'],
            'form_token' => ['nullable', 'string', 'max:100'],
            'website' => ['nullable', 'string', 'max:200'],
            'whatsapp_opt_in' => ['nullable', 'boolean'],
            'utm' => ['nullable', 'array'],
            'ab' => ['nullable', 'integer', 'min:1'],
            'offer_id' => ['nullable', 'integer', 'min:0'],
            'shipping_company_id' => ['nullable', 'integer', 'min:1'],
            // "cod" or a store payment method id.
            'payment_method' => ['nullable', 'string', 'max:20'],
            'ip' => ['nullable', 'ip'],
            'user_agent' => ['nullable', 'string', 'max:2000'],
            'idempotency_key' => ['nullable', 'uuid'],
        ];
    }

    /** @return array<string, string> */
    public function messages(): array
    {
        return ['ip.ip' => __('orders.invalid_ip')];
    }
}
