<?php

declare(strict_types=1);

namespace App\Http\Requests\Dashboard;

use App\Http\Requests\ApiRequest;
use App\Rules\TenantExists;
use App\Shipping\Carriers\Carriers;

/** The merchant's own carrier credentials (the fields its carrier asks for), and optionally the company it ships for. */
final class ConnectCarrierRequest extends ApiRequest
{
    /** @return array<string, mixed> */
    public function rules(): array
    {
        $rules = [
            'credentials' => ['required', 'array'],
            'company_id' => ['sometimes', 'nullable', 'integer', TenantExists::table('shipping_companies')],
        ];
        foreach ($this->fields() as $field) {
            $rules['credentials.'.$field['key']] = ['required', 'string', 'min:2', 'max:500'];
        }

        return $rules;
    }

    /** @return array<string, string> only the carrier's own fields, trimmed */
    public function credentials(): array
    {
        $out = [];
        foreach ($this->fields() as $field) {
            $out[$field['key']] = trim((string) $this->validated('credentials.'.$field['key']));
        }

        return $out;
    }

    /** @return array<string, string> */
    public function attributes(): array
    {
        $names = [];
        foreach ((array) __('shipping.carriers.fields.'.$this->route('carrier')) as $key => $label) {
            $names['credentials.'.$key] = (string) $label;
        }

        return [...parent::attributes(), ...$names];
    }

    /** @return list<array{key: string, secret: bool}> */
    private function fields(): array
    {
        $carrier = (string) $this->route('carrier');
        $carriers = app(Carriers::class);

        return $carriers->has($carrier) ? $carriers->get($carrier)->credentialFields() : [];
    }
}
