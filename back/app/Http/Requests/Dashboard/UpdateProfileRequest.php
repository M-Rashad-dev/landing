<?php

declare(strict_types=1);

namespace App\Http\Requests\Dashboard;

use App\Http\Requests\ApiRequest;
use App\Rules\EgyptPhone;
use App\Services\PhoneNormalizer;
use Illuminate\Validation\Rule;

final class UpdateProfileRequest extends ApiRequest
{
    protected function prepareForValidation(): void
    {
        $merge = [];

        if (is_string($this->input('email'))) {
            $merge['email'] = mb_strtolower(trim($this->input('email')));
        }

        if (is_string($this->input('phone'))) {
            $merge['phone'] = app(PhoneNormalizer::class)->normalize($this->input('phone')) ?? $this->input('phone');
        }

        if (is_string($this->input('name'))) {
            $merge['name'] = trim($this->input('name'));
        }

        $this->merge($merge);
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        $userId = $this->user()?->getKey();

        return [
            'name' => ['sometimes', 'required', 'string', 'min:2', 'max:100'],
            'email' => ['sometimes', 'required', 'string', 'email:filter', 'max:191', Rule::unique('users', 'email')->ignore($userId)],
            'phone' => ['sometimes', 'required', 'string', new EgyptPhone, Rule::unique('users', 'phone')->ignore($userId)],
        ];
    }
}
