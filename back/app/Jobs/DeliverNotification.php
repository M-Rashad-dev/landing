<?php

declare(strict_types=1);

namespace App\Jobs;

use App\Enums\MessagePurpose;
use App\Enums\NotifyChannel;
use App\Mail\NotificationMail;
use App\Messaging\WhatsApp\WhatsAppError;
use App\Messaging\WhatsApp\WhatsAppMessenger;
use App\Models\UserNotification;
use App\Services\PublicSite;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Mail;
use Throwable;

/**
 * The outside copy of a bell notification: WhatsApp (an approved template) or email, as chosen.
 * WhatsApp that can't go (no keys, no phone, Meta refused) falls back to email. Never retried:
 * a late duplicate is worse than a missing one, and the bell already has it.
 */
final class DeliverNotification implements ShouldQueue
{
    use Queueable;

    public int $tries = 1;

    public function __construct(
        public readonly int $notificationId,
        public readonly NotifyChannel $channel,
        public readonly ?string $phone,
        public readonly ?string $email,
    ) {}

    public function handle(WhatsAppMessenger $messenger): void
    {
        $notification = UserNotification::query()->find($this->notificationId);
        if ($notification === null) {
            return;
        }

        if ($this->channel === NotifyChannel::WhatsApp && $this->whatsapp($notification, $messenger)) {
            return;
        }

        $this->mail($notification);
    }

    private function whatsapp(UserNotification $notification, WhatsAppMessenger $messenger): bool
    {
        $copy = $notification->payload['whatsapp'] ?? null;
        if (! is_array($copy) || $this->phone === null || $this->phone === '' || ! $messenger->configured()) {
            return false;
        }

        try {
            $messenger->sendTemplate($this->phone, (string) $copy['template'], array_values($copy['params'] ?? []), $copy['button'] ?? null, MessagePurpose::Notification, $notification->tenant_id);

            return true;
        } catch (WhatsAppError) {
            // Written to the message log as failed; the email copy goes instead.
            return false;
        }
    }

    private function mail(UserNotification $notification): void
    {
        if ($this->email === null || $this->email === '') {
            return;
        }

        $payload = $notification->payload ?? [];
        $url = $notification->link === null ? null : rtrim(PublicSite::url((string) config('landing.app_host')), '/').$notification->link;

        try {
            Mail::to($this->email)->send(new NotificationMail(
                $notification->event->value,
                $notification->title,
                $notification->body,
                array_values($payload['rows'] ?? []),
                $url === null ? null : ($payload['action'] ?? __('notifications.mail.open')),
                $url,
                $notification->tenant_id === null ? __('notifications.mail.brand_admin') : __('notifications.mail.brand'),
            ));
        } catch (Throwable $e) {
            report($e);
        }
    }
}
