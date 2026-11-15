<?php

declare(strict_types=1);

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

/**
 * Every notification email (store owners and the platform owner): a title, a line, a few
 * label / value rows and a button to the page that handles it. The provider is MAIL_* in .env
 * (only written to the log until it is set); tests use Mail::fake().
 */
final class NotificationMail extends Mailable
{
    use Queueable, SerializesModels;

    /** @param  list<array{label: string, value: string}>  $rows */
    public function __construct(
        public readonly string $event,
        public readonly string $heading,
        public readonly string $intro,
        public readonly array $rows = [],
        public readonly ?string $actionLabel = null,
        public readonly ?string $actionUrl = null,
        public readonly ?string $brand = null,
        public readonly ?string $footer = null,
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(subject: $this->heading);
    }

    public function content(): Content
    {
        return new Content(view: 'mail.notification');
    }
}
