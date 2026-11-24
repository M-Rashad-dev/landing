<?php

declare(strict_types=1);

namespace App\Http\Requests\Dashboard;

use App\Enums\RefundMethod;
use App\Store\Payments\StorePayments;
use App\Support\Money;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Http\UploadedFile;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

/**
 * «رد مبلغ» on an order (JSON, or multipart when a proof is attached and it is already done). The limits against what
 * was paid are checked by App\Orders\Refunds inside the order's lock.
 */
final class RefundRequest extends FormRequest
{
    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'amount' => ['required', 'numeric', 'gt:0', 'max:99999999', 'regex:/^\d+(\.\d{1,2})?$/'],
            'items' => ['sometimes', 'array', 'max:100'],
            'items.*.order_item_id' => ['required', 'integer', 'min:1'],
            'items.*.quantity' => ['required', 'integer', 'min:1', 'max:100000'],
            'reason' => ['nullable', 'string', 'max:300'],
            'method' => ['required', Rule::enum(RefundMethod::class)],
            'destination' => ['nullable', 'string', 'max:120'],
            'restock' => ['sometimes', 'boolean'],
            'revoke_digital' => ['sometimes', 'boolean'],
            // Already sent: done at once, with its reference / proof.
            'done' => ['sometimes', 'boolean'],
            'reference' => ['nullable', 'string', 'max:120'],
            'proof' => ['nullable', 'file', 'max:'.StorePayments::RECEIPT_MAX_KB],
        ];
    }

    public function after(): array
    {
        return [function (Validator $validator): void {
            $proof = $this->file('proof');
            if ($proof instanceof UploadedFile && ($problem = StorePayments::receiptProblem($proof)) !== null) {
                $validator->errors()->add('proof', $problem);
            }
        }];
    }

    /** @return array{amount: int, items: list<array{order_item_id: int, quantity: int}>, reason: string|null, method: RefundMethod, destination: string|null, restock: bool, revoke_digital: bool, done: bool, reference: string|null} */
    public function values(): array
    {
        $data = $this->validated();

        return [
            'amount' => Money::toCents((string) $data['amount']),
            'items' => array_values(array_map(fn (array $l) => ['order_item_id' => (int) $l['order_item_id'], 'quantity' => (int) $l['quantity']], $data['items'] ?? [])),
            'reason' => $data['reason'] ?? null,
            'method' => RefundMethod::from((string) $data['method']),
            'destination' => $data['destination'] ?? null,
            'restock' => (bool) ($data['restock'] ?? false),
            'revoke_digital' => (bool) ($data['revoke_digital'] ?? false),
            'done' => (bool) ($data['done'] ?? false),
            'reference' => $data['reference'] ?? null,
        ];
    }

    public function proof(): ?UploadedFile
    {
        $file = $this->file('proof');

        return $file instanceof UploadedFile ? $file : null;
    }
}
