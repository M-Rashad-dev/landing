<?php

declare(strict_types=1);

namespace App\Http\Requests\Dashboard;

use App\Enums\StoreMailMode;
use App\Http\Requests\ApiRequest;
use App\Models\StoreMailSetting;
use Illuminate\Validation\Rule;

/** «الإيميلات»: the sender name, where replies go, and the merchant's own mailbox (SMTP) when he picks it. */
final class StoreMailRequest extends ApiRequest
{
    protected function prepareForValidation(): void
    {
        $merge = [];
        foreach (['sender_name', 'reply_to', 'smtp_host', 'smtp_username', 'from_address'] as $key) {
            if (is_string($this->input($key))) {
                $value = trim(strip_tags($this->input($key)));
                $merge[$key] = $value === '' ? null : ($key === 'sender_name' ? $value : mb_strtolower($value));
            }
        }
        // App passwords are shown with spaces (Gmail: "abcd efgh ijkl mnop"); the spaces aren't part of it.
        if (is_string($this->input('smtp_password'))) {
            $password = str_replace(' ', '', trim($this->input('smtp_password')));
            $merge['smtp_password'] = $password === '' ? null : $password;
        }
        $this->merge($merge);
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        $smtp = $this->input('mode') === StoreMailMode::Smtp->value;
        $need = $smtp ? 'required' : 'nullable';

        return [
            'mode' => ['required', Rule::enum(StoreMailMode::class)],
            'sender_name' => ['nullable', 'string', 'max:60'],
            'reply_to' => ['nullable', 'email:rfc', 'max:191'],
            'smtp_host' => [$need, 'string', 'max:191', 'regex:/^(?=.{1,191}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/'],
            'smtp_port' => [$need, 'integer', Rule::in(StoreMailSetting::PORTS)],
            'smtp_encryption' => [$need, 'string', Rule::in(StoreMailSetting::ENCRYPTIONS)],
            'smtp_username' => [$need, 'string', 'max:191'],
            // Empty keeps the saved one; required the first time.
            'smtp_password' => ['nullable', 'string', 'max:200'],
            'from_address' => ['nullable', 'email:rfc', 'max:191'],
        ];
    }

    /** @return array<string, string> */
    public function messages(): array
    {
        return ['smtp_host.regex' => (string) __('store_mail.host_format')];
    }
}
