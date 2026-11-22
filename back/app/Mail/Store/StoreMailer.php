<?php

declare(strict_types=1);

namespace App\Mail\Store;

use App\Enums\StoreMailMode;
use App\Enums\UserRole;
use App\Models\Identity;
use App\Models\StoreMailSetting;
use App\Models\Tenant;
use App\Models\User;
use App\Notifications\StoreNotices;
use Illuminate\Mail\Mailable;
use Illuminate\Support\Facades\Mail;

/**
 * Every email a store sends its customers goes through here (inside the store's tenant). From the merchant's own
 * mailbox when he set one; when that fails (or there is none) from the platform's address, always with the store's
 * name as sender and replies to the merchant. A failing mailbox is marked and the merchant told (once a day).
 * Throws only when the platform mail fails too.
 */
final class StoreMailer
{
    public function __construct(private readonly Mailbox $mailbox, private readonly StoreNotices $notices) {}

    /**
     * @param  bool  $fallback  false: a failing own mailbox throws MailboxError instead (the test email)
     * @return StoreMailMode the mailbox it left from
     */
    public function send(int $tenantId, string $to, Mailable $mail, bool $fallback = true): StoreMailMode
    {
        $settings = StoreMailSetting::query()->first() ?? new StoreMailSetting;
        $name = $this->senderName($tenantId, $settings);
        $mail->replyTo = [];
        if (($replyTo = $this->replyTo($tenantId, $settings)) !== null) {
            $mail->replyTo($replyTo, $name);
        }

        if ($settings->exists && $settings->usesSmtp()) {
            $mail->from = [];
            $mail->from($settings->fromAddress(), $name);
            try {
                $this->mailbox->send($settings, $to, $mail);
                if ($settings->status !== StoreMailSetting::ACTIVE) {
                    $settings->forceFill(['status' => StoreMailSetting::ACTIVE, 'last_error' => null, 'checked_at' => now()])->save();
                }

                return StoreMailMode::Smtp;
            } catch (MailboxError $e) {
                $settings->forceFill(['status' => StoreMailSetting::FAILED, 'last_error' => mb_substr($e->getMessage(), 0, 255), 'checked_at' => now()])->save();
                if (! $fallback) {
                    throw $e;
                }
                $this->notices->mailboxFailed($tenantId, $e->getMessage());
            }
        }

        $mail->from = [];
        $mail->to = [];
        $mail->from((string) config('mail.from.address'), $name);
        Mail::to($to)->send($mail);

        return StoreMailMode::Platform;
    }

    /** The sender name customers see: the one set, else the store's name. */
    public function senderName(int $tenantId, StoreMailSetting $settings): string
    {
        return mb_substr($settings->sender_name ?: (string) Tenant::query()->whereKey($tenantId)->value('name'), 0, 60);
    }

    /** Where replies go: the address set, else the store identity's contact email, else the owner's login email. */
    public function replyTo(int $tenantId, StoreMailSetting $settings): ?string
    {
        if ($settings->reply_to) {
            return $settings->reply_to;
        }
        $identity = Identity::query()->orderByDesc('is_default')->orderBy('id')->first();
        $contact = $identity?->contact['email'] ?? null;
        if (is_string($contact) && filter_var($contact, FILTER_VALIDATE_EMAIL) !== false) {
            return $contact;
        }
        $owner = User::query()->where('tenant_id', $tenantId)->where('role', UserRole::Owner)->orderBy('id')->value('email');

        return is_string($owner) && $owner !== '' ? $owner : null;
    }
}
