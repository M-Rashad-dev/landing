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
            'type' => ['required', Rule::in(['subscription', 'theme', 'ai_credit', 'message_pack'])],
            'plan_key' => ['required_if:type,subscription', 'nullable', 'string', 'max:40'],
            'period' => ['required_if:type,subscription', 'nullable', Rule::enum(BillingPeriod::class)],
            'theme_key' => ['required_if:type,theme', 'nullable', 'string', 'max:40'],
            // AI balance top-up, in EGP (a package or at least the least amount: Invoices::forAiCredit).
            'amount' => ['required_if:type,ai_credit', 'nullable', 'integer', 'min:1', 'max:100000'],
            // A WhatsApp message pack for cart reminders (one of the platform's packs: Invoices::forMessagePack).
            'messages' => ['required_if:type,message_pack', 'nullable', 'integer', 'min:1', 'max:1000000'],
            // Placing only (the preview ignores them); required when there is something to transfer.
            'method' => ['nullable', 'string', 'max:40'],
            'sender_ref' => ['nullable', 'string', 'max:120'],
            // Content and type are checked again (decoded and re-encoded) by ReceiptStore.
            'receipt' => ['nullable', 'file', 'max:5120', 'mimes:jpg,jpeg,png,webp'],
        ];
    }

    /** @return array{type: string, plan_key: string|null, period: string|null, theme_key: string|null, amount: int|null, messages: int|null} */
    public function item(): array
    {
        return [
            'type' => (string) $this->validated('type'),
            'plan_key' => $this->validated('plan_key'),
            'period' => $this->validated('period'),
            'theme_key' => $this->validated('theme_key'),
            'amount' => $this->validated('amount') === null ? null : (int) $this->validated('amount'),
            'messages' => $this->validated('messages') === null ? null : (int) $this->validated('messages'),
        ];
    }

    public function senderRef(): ?string
    {
        $ref = $this->validated('sender_ref');

        return $ref === null ? null : trim(strip_tags((string) $ref));
    }
}
