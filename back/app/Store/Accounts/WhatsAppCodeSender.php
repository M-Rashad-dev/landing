<?php

declare(strict_types=1);

namespace App\Store\Accounts;

use App\Enums\MessagePurpose;
use App\Exceptions\ApiException;
use App\Messaging\WhatsApp\WhatsAppError;
use App\Messaging\WhatsApp\WhatsAppMessenger;
use Illuminate\Validation\ValidationException;

/** Customer sign-in codes on WhatsApp (the platform's Mksab number, Meta's authentication template). */
final class WhatsAppCodeSender implements CodeSender
{
    public function __construct(private readonly WhatsAppMessenger $messenger) {}

    public function channel(): string
    {
        return 'whatsapp';
    }

    public function available(): bool
    {
        return $this->messenger->configured();
    }

    public function send(string $phone, string $code, string $storeName, ?int $tenantId): bool
    {
        try {
            $this->messenger->sendCode($phone, $code, MessagePurpose::CustomerCode, $tenantId);
        } catch (WhatsAppError $e) {
            if ($e->unreachableNumber()) {
                throw ValidationException::withMessages(['phone' => [__('accounts.not_on_whatsapp')]]);
            }
            report($e);
            throw new ApiException(503, 'code_not_sent', __('accounts.code_not_sent'));
        }

        return false;
    }
}
