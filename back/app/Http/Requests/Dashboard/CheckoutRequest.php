<?php

declare(strict_types=1);

namespace App\Http\Requests\Dashboard;

use App\Enums\BillingPeriod;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/** What is bought (a plan period or a theme) and, when placing it, the transfer receipt. */
final class CheckoutRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'type' => ['required', Rule::in(['subscription', 'theme'])],
            'plan_key' => ['required_if:type,subscription', 'nullable', 'string', 'max:40'],
            'period' => ['required_if:type,subscription', 'nullable', Rule::enum(BillingPeriod::class)],
            'theme_key' => ['required_if:type,theme', 'nullable', 'string', 'max:40'],
            // Placing only (the preview ignores them); required when there is something to transfer.
            'method' => ['nullable', 'string', 'max:40'],
            'sender_ref' => ['nullable', 'string', 'min:3', 'max:120'],
            // Content and type are checked again (decoded and re-encoded) by ReceiptStore.
            'receipt' => ['nullable', 'file', 'max:5120', 'mimes:jpg,jpeg,png,webp'],
        ];
    }

    /** @return array{type: string, plan_key: string|null, period: string|null, theme_key: string|null} */
    public function item(): array
    {
        return [
            'type' => (string) $this->validated('type'),
            'plan_key' => $this->validated('plan_key'),
            'period' => $this->validated('period'),
            'theme_key' => $this->validated('theme_key'),
        ];
    }

    public function senderRef(): ?string
    {
        $ref = $this->validated('sender_ref');

        return $ref === null ? null : trim(strip_tags((string) $ref));
    }
}
