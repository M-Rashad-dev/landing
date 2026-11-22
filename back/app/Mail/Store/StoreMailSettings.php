<?php

declare(strict_types=1);

namespace App\Mail\Store;

use App\Enums\StoreMailMode;
use App\Mail\NotificationMail;
use App\Models\StoreMailSetting;
use App\Models\Tenant;
use App\Tenancy\Tenancy;
use Illuminate\Validation\ValidationException;

/** Saving the store's email settings (a mailbox is logged in to before it is kept), the test email, forgetting it. */
final class StoreMailSettings
{
    private const SMTP_FIELDS = ['smtp_host', 'smtp_port', 'smtp_encryption', 'smtp_username', 'from_address'];

    public function __construct(private readonly Mailbox $mailbox, private readonly StoreMailer $mailer) {}

    public function current(): StoreMailSetting
    {
        return StoreMailSetting::query()->first() ?? new StoreMailSetting;
    }

    /** @param  array<string, mixed>  $data validated StoreMailRequest */
    public function save(array $data): StoreMailSetting
    {
        $settings = $this->current();
        $settings->fill(['mode' => $data['mode'], 'sender_name' => $data['sender_name'] ?? null, 'reply_to' => $data['reply_to'] ?? null]);

        if ($settings->mode === StoreMailMode::Smtp) {
            $mailboxChanged = false;
            foreach (self::SMTP_FIELDS as $field) {
                $value = $data[$field] ?? null;
                $mailboxChanged = $mailboxChanged || (string) $settings->getAttribute($field) !== (string) $value;
                $settings->setAttribute($field, $value);
            }
            if (($data['smtp_password'] ?? null) !== null) {
                $settings->smtp_password = (string) $data['smtp_password'];
                $mailboxChanged = true;
            }
            if ($settings->smtp_password === null) {
                throw ValidationException::withMessages(['smtp_password' => (string) __('store_mail.password_required')]);
            }
            // A new or changed mailbox is kept only once we could log in to it.
            if ($mailboxChanged || $settings->status !== StoreMailSetting::ACTIVE) {
                try {
                    $this->mailbox->check($settings);
                } catch (MailboxError $e) {
                    throw ValidationException::withMessages(['smtp_password' => $e->getMessage()]);
                }
                $settings->forceFill(['status' => StoreMailSetting::ACTIVE, 'last_error' => null, 'checked_at' => now()]);
            }
        }

        $settings->save();

        return $settings;
    }

    /** The mailbox details and password are deleted; emails go from the platform again. */
    public function forget(): StoreMailSetting
    {
        $settings = $this->current();
        if ($settings->exists) {
            $settings->forceFill(array_fill_keys([...self::SMTP_FIELDS, 'smtp_password', 'status', 'last_error', 'checked_at'], null) + ['mode' => StoreMailMode::Platform])->save();
        }

        return $settings;
    }

    /**
     * «ابعت إيميل تجربة»: one email the way customers get them, to the address given.
     *
     * @return StoreMailMode the mailbox it left from
     *
     * @throws MailboxError the store's own mailbox refused (nothing sent)
     */
    public function test(string $to): StoreMailMode
    {
        $tenantId = (int) Tenancy::id();
        $settings = $this->current();
        $store = (string) Tenant::query()->whereKey($tenantId)->value('name');
        $name = $this->mailer->senderName($tenantId, $settings);
        $reply = $this->mailer->replyTo($tenantId, $settings) ?? '—';
        $own = $settings->exists && $settings->usesSmtp();

        return $this->mailer->send($tenantId, $to, new NotificationMail(
            'store_mail_test',
            (string) __('store_mail.test.subject', ['store' => $store]),
            (string) __($own ? 'store_mail.test.intro_store' : 'store_mail.test.intro_platform', ['reply' => $reply]),
            [
                ['label' => (string) __('store_mail.test.sender'), 'value' => $name],
                ['label' => (string) __('store_mail.test.from'), 'value' => $own ? $settings->fromAddress() : (string) config('mail.from.address')],
                ['label' => (string) __('store_mail.test.reply'), 'value' => $reply],
            ],
            brand: $store,
            footer: (string) __('store_mail.test.footer', ['store' => $store]),
        ), fallback: false);
    }
}
