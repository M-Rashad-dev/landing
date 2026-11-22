<?php

declare(strict_types=1);

namespace App\Mail\Store;

use App\Models\StoreMailSetting;
use Illuminate\Mail\Mailable;

/**
 * The merchant's own mailbox (SMTP with an app password). Real: SmtpMailbox; tests: FakeMailbox
 * (config mail.store_mailbox = fake).
 */
interface Mailbox
{
    /** Logs in and out. Throws MailboxError with a reason the merchant can act on. */
    public function check(StoreMailSetting $settings): void;

    /** Sends one email (from / reply-to already set on it). Throws MailboxError. */
    public function send(StoreMailSetting $settings, string $to, Mailable $mail): void;
}
