<?php

declare(strict_types=1);

namespace App\Http\Requests\Auth;

use App\Http\Requests\ApiRequest;
use App\Rules\EgyptPhone;
use App\Services\PhoneNormalizer;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;

final class RegisterRequest extends ApiRequest
{
    protected function prepareForValidation(): void
    {
        $phone = $this->input('phone');
        $normalized = is_string($phone) ? app(PhoneNormalizer::class)->normalize($phone) : null;

        $this->merge([
            'email' => is_string($this->input('email')) ? mb_strtolower(trim($this->input('email'))) : $this->input('email'),
            'phone' => $normalized ?? $phone,
            'name' => is_string($this->input('name')) ? trim($this->input('name')) : $this->input('name'),
            'store_name' => is_string($this->input('store_name')) ? trim($this->input('store_name')) : $this->input('store_name'),
        ]);
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'min:2', 'max:100'],
            'email' => ['required', 'string', 'email:filter', 'max:191', Rule::unique('users', 'email')],
            'phone' => ['required', 'string', new EgyptPhone, Rule::unique('users', 'phone')],
            'store_name' => ['required', 'string', 'min:2', 'max:100'],
            'password' => ['required', 'string', 'confirmed', Password::min(8)],
        ];
    }
}
