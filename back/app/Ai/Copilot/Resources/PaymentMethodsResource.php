<?php

declare(strict_types=1);

namespace App\Ai\Copilot\Resources;

use App\Ai\Copilot\Contracts\CopilotResource;
use App\Ai\Copilot\Contracts\Field;
use App\Enums\StorePaymentKind;
use App\Models\StorePaymentMethod;
use Illuminate\Database\Eloquent\Model;

/** «طرق الدفع»: the store's own prepaid methods (read only; money settings stay with the merchant). */
final class PaymentMethodsResource extends CopilotResource
{
    public function key(): string
    {
        return 'payment_methods';
    }

    public function label(): string
    {
        return 'طرق الدفع';
    }

    public function summary(): string
    {
        return 'The store\'s own ways to be paid before delivery (InstaPay, mobile wallets, bank transfer, a payment link): the customer pays the merchant directly, uploads the receipt, the merchant confirms it (orders wait in status awaiting_payment). Cash on delivery is on unless the merchant turned it off. Managed on /dashboard/settings/payments.';
    }

    public function model(): string
    {
        return StorePaymentMethod::class;
    }

    public function fields(): array
    {
        $kinds = [];
        foreach (StorePaymentKind::cases() as $kind) {
            $kinds[$kind->value] = $kind->label();
        }

        return [
            Field::text('name')->label('الاسم')->searchable(),
            Field::enum('kind', StorePaymentKind::class)->label('النوع')->labels($kinds)->filterable(),
            Field::text('account')->label('الحساب'),
            Field::bool('is_active')->label('شغالة')->filterable(),
        ];
    }

    public function url(?Model $row): ?string
    {
        return '/dashboard/settings/payments';
    }
}
