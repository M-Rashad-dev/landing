<?php

declare(strict_types=1);

namespace App\Http\Resources;

use App\Mail\Store\StoreMailer;
use App\Models\StoreMailSetting;
use App\Tenancy\Tenancy;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** The store's email settings as the merchant sees them (never the password). @mixin StoreMailSetting */
final class StoreMailSettingResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        $mailer = app(StoreMailer::class);
        $tenantId = (int) Tenancy::id();
        $blank = new StoreMailSetting;

        return [
            'mode' => $this->mode->value,
            'sender_name' => $this->sender_name,
            'reply_to' => $this->reply_to,
            // What is used when the fields are left empty.
            'default_sender_name' => $mailer->senderName($tenantId, $blank),
            'default_reply_to' => $mailer->replyTo($tenantId, $blank),
            'platform_address' => (string) config('mail.from.address'),
            'smtp' => [
                'host' => $this->smtp_host,
                'port' => $this->smtp_port,
                'encryption' => $this->smtp_encryption,
                'username' => $this->smtp_username,
                'from_address' => $this->from_address,
                'has_password' => $this->smtp_password !== null,
            ],
            'status' => $this->status,
            'last_error' => $this->last_error,
            'checked_at' => $this->checked_at?->toIso8601ZuluString(),
        ];
    }
}
