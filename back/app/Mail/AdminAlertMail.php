<?php

declare(strict_types=1);

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

/**
 * One email to the platform owner: a title, a line, a few label / value rows and a button to
 * the admin page that handles it. Built by AdminAlerts; the provider is whatever MAIL_MAILER is.
 */
final class AdminAlertMail extends Mailable implements ShouldQueue
{
    use Queueable, SerializesModels;

    /** @param  list<array{label: string, value: string}>  $rows */
    public function __construct(
        public readonly string $alert,
        public readonly string $heading,
        public readonly string $intro,
        public readonly array $rows = [],
        public readonly ?string $actionLabel = null,
        public readonly ?string $actionUrl = null,
    ) {
        $this->afterCommit();
    }

    public function envelope(): Envelope
    {
        return new Envelope(subject: $this->heading);
    }

    public function content(): Content
    {
        return new Content(view: 'mail.admin-alert');
    }
}
