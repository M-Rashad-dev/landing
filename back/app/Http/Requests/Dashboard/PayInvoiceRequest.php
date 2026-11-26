<?php

declare(strict_types=1);

namespace App\Http\Requests\Dashboard;

use App\Billing\Payments\OnlinePayments;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/** A manual transfer (which method, the transfer reference / sender number, the receipt image), or an online method (the method only). */
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
            // Optional: helps the reviewer find the transfer.
            'sender_ref' => ['nullable', 'string', 'max:120'],
            // Content and type are checked again (decoded and re-encoded) by ReceiptStore.
            'receipt' => [Rule::requiredIf(fn () => ! $this->online()), 'nullable', 'file', 'max:5120', 'mimes:jpg,jpeg,png,webp'],
        ];
    }

    /** Paid on the gateway's page: no receipt. */
    public function online(): bool
    {
        return app(OnlinePayments::class)->isOnline(is_string($this->input('method')) ? $this->input('method') : null);
    }

    public function senderRef(): string
    {
        return trim(strip_tags((string) $this->validated('sender_ref')));
    }
}
