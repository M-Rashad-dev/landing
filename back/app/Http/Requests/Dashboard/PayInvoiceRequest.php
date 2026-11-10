<?php

declare(strict_types=1);

namespace App\Http\Requests\Dashboard;

use Illuminate\Foundation\Http\FormRequest;

/** A manual transfer: which method, the transfer reference / sender number, and the receipt image. */
final class PayInvoiceRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'method' => ['required', 'string', 'max:40'],
            'sender_ref' => ['required', 'string', 'min:3', 'max:120'],
            // Content and type are checked again (decoded and re-encoded) by ReceiptStore.
            'receipt' => ['required', 'file', 'max:5120', 'mimes:jpg,jpeg,png,webp'],
        ];
    }

    public function senderRef(): string
    {
        return trim(strip_tags((string) $this->validated('sender_ref')));
    }
}
