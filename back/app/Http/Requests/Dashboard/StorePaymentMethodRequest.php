<?php

declare(strict_types=1);

namespace App\Http\Requests\Dashboard;

use App\Enums\StorePaymentKind;
use App\Http\Requests\ApiRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

/** One of the store's own ways to be paid before delivery. */
final class StorePaymentMethodRequest extends ApiRequest
{
    protected function prepareForValidation(): void
    {
        $merge = [];
        foreach (['name', 'account', 'link', 'instructions'] as $key) {
            if (is_string($this->input($key))) {
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
            // Online methods come from connecting a gateway, never typed by hand.
            'kind' => ['required', Rule::enum(StorePaymentKind::class)->only(StorePaymentKind::manual())],
            'name' => ['required', 'string', 'max:60'],
            'account' => ['nullable', 'string', 'max:120'],
            'link' => ['nullable', 'string', 'max:500', 'url:https'],
            'instructions' => ['nullable', 'string', 'max:500'],
            'is_active' => ['sometimes', 'boolean'],
        ];
    }

    /** @return array<string, string> */
    public function messages(): array
    {
        return ['link.url' => (string) __('payments.link_https')];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator): void {
            if ($validator->errors()->isNotEmpty()) {
                return;
            }
            $kind = StorePaymentKind::from((string) $this->input('kind'));
            // A link needs its URL; the others need where to send the money (InstaPay may give a link instead).
            if ($kind === StorePaymentKind::Link && $this->input('link') === null) {
                $validator->errors()->add('link', (string) __('payments.link_required'));
            }
            if ($kind !== StorePaymentKind::Link && $this->input('account') === null && ! ($kind === StorePaymentKind::Instapay && $this->input('link') !== null)) {
                $validator->errors()->add('account', (string) __('payments.account_required'));
            }
        });
    }
}
