<?php

declare(strict_types=1);

namespace App\Mail\Store;

use App\Models\StoreMailSetting;
use Illuminate\Mail\Mailable;

/** Tests and e2e: remembers what it would have sent; `$fail` makes every call refuse with that reason. */
final class FakeMailbox implements Mailbox
{
    public ?string $fail = null;

    public int $checks = 0;

    /** @var list<array{to: string, from: string, mail: Mailable}> */
    public array $sent = [];

    public function check(StoreMailSetting $settings): void
    {
        $this->checks++;
        if ($this->fail !== null) {
            throw new MailboxError($this->fail);
        }
    }

    public function send(StoreMailSetting $settings, string $to, Mailable $mail): void
    {
        if ($this->fail !== null) {
            throw new MailboxError($this->fail);
        }
        $this->sent[] = ['to' => $to, 'from' => $settings->fromAddress(), 'mail' => $mail];
    }
}
