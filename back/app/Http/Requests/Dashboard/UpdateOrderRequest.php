<?php

declare(strict_types=1);

namespace App\Http\Requests\Dashboard;

use App\Services\PhoneNormalizer;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

final class UpdateOrderRequest extends FormRequest
{
    protected function prepareForValidation(): void
    {
        $merge = [];
        foreach (['customer_name', 'customer_phone', 'customer_phone2', 'governorate', 'city', 'address', 'notes', 'internal_note'] as $key) {
            if ($this->has($key) && is_string($this->input($key))) {
                $value = trim(strip_tags($this->input($key)));
                $merge[$key] = $value === '' ? null : $value;
            }
        }
        $this->merge($merge);
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'customer_name' => ['sometimes', 'required', 'string', 'min:2', 'max:80'],
            'customer_phone' => ['sometimes', 'required', 'string', 'max:30'],
            'customer_phone2' => ['sometimes', 'nullable', 'string', 'max:30'],
            'governorate' => ['sometimes', 'nullable', 'string', Rule::in(config('landing.governorates'))],
            'city' => ['sometimes', 'nullable', 'string', 'max:100'],
            'address' => ['sometimes', 'nullable', 'string', 'max:300'],
            'notes' => ['sometimes', 'nullable', 'string', 'max:500'],
            'internal_note' => ['sometimes', 'nullable', 'string', 'max:2000'],
        ];
    }

    public function after(): array
    {
        return [function (Validator $validator): void {
            $phones = app(PhoneNormalizer::class);
            foreach (['customer_phone', 'customer_phone2'] as $key) {
                $value = $this->input($key);
                if (is_string($value) && $value !== '' && ! $phones->isValid($value)) {
                    $validator->errors()->add($key, __('orders.invalid_phone'));
                }
            }
        }];
    }

    /** @return array<string, string|null> validated values with phones in E.164 */
    public function values(): array
    {
        $data = $this->validated();
        $phones = app(PhoneNormalizer::class);
        foreach (['customer_phone', 'customer_phone2'] as $key) {
            if (isset($data[$key])) {
                $data[$key] = $phones->normalize($data[$key]);
            }
        }

        return $data;
    }
}
