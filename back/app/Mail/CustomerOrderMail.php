<?php

declare(strict_types=1);

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Address;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

/** An order update to a store's customer, in the store's name (the platform's address, the store as sender name). */
final class CustomerOrderMail extends Mailable
{
    use Queueable, SerializesModels;

    /** @param  list<array{label: string, value: string}>  $rows */
    public function __construct(
        public readonly string $event,
        public readonly string $store,
        public readonly string $heading,
        public readonly string $intro,
        public readonly array $rows,
        public readonly string $actionLabel,
        public readonly ?string $actionUrl,
        public readonly string $footer,
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(
            from: new Address((string) config('mail.from.address'), mb_substr($this->store, 0, 60)),
            subject: $this->heading,
        );
    }

    public function content(): Content
    {
        return new Content(view: 'mail.notification', with: ['brand' => $this->store]);
    }
}
