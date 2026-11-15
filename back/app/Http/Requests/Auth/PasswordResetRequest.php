<?php

declare(strict_types=1);

namespace App\Http\Requests\Auth;

use App\Http\Requests\ApiRequest;
use Illuminate\Validation\Rules\Password;

final class PasswordResetRequest extends ApiRequest
{
    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'login' => ['required', 'string', 'max:191'],
            'code' => ['required', 'string', 'regex:/^\d{6}$/'],
            'password' => ['required', 'string', 'confirmed', Password::min(8)],
        ];
    }
}
