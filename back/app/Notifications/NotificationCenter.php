<?php

declare(strict_types=1);

namespace App\Notifications;

use App\Billing\PlatformSettings;
use App\Enums\AdminAlert;
use App\Enums\NotifyChannel;
use App\Enums\UserRole;
use App\Events\NotificationCreated;
use App\Jobs\DeliverNotification;
use App\Models\User;
use App\Models\UserNotification;
use Illuminate\Database\UniqueConstraintViolationException;
use Throwable;

/**
 * The one way to tell a dashboard user something: a bell notification (live through Reverb)
 * plus an outside copy on WhatsApp or email (DeliverNotification, queued after commit).
 * Store owners choose their channel on their account; the platform owner chooses it, the
 * events and the phone / email in the admin settings. Never breaks the action that caused it.
 */
final class NotificationCenter
{
    public function __construct(private readonly PlatformSettings $settings) {}

    /** Everyone who runs this store. */
    public function toStore(int $tenantId, Notice $notice): void
    {
        $this->safely(function () use ($tenantId, $notice): void {
            $users = User::query()->where('tenant_id', $tenantId)->where('is_active', true)->get();
            foreach ($users as $user) {
                $row = $this->bell($user, $tenantId, $notice);
                if ($row !== null) {
                    DeliverNotification::dispatch($row->id, $user->notify_channel, $user->phone, $user->email)->afterCommit();
                }
            }
        });
    }

    /** The platform's admins: every one gets the bell; the outside copy goes once, if this alert is on. */
    public function toPlatform(Notice $notice, ?int $tenantId = null): void
    {
        $this->safely(function () use ($notice, $tenantId): void {
            $admins = User::query()->where('role', UserRole::SuperAdmin)->where('is_active', true)->orderBy('id')->get();
            $first = null;
            foreach ($admins as $admin) {
                $row = $this->bell($admin, null, $notice, $tenantId);
                $first ??= $row === null ? null : [$row, $admin];
            }
            if ($first === null || ! $this->wantsOutside($notice)) {
                return;
            }

            [$row, $admin] = $first;
            $all = $this->settings->all();
            $channel = NotifyChannel::tryFrom((string) ($all['alert_channel'] ?? '')) ?? NotifyChannel::WhatsApp;
            $phone = is_string($all['alert_phone'] ?? null) && $all['alert_phone'] !== '' ? $all['alert_phone'] : $admin->phone;
            $email = is_string($all['alert_email'] ?? null) && $all['alert_email'] !== '' ? $all['alert_email'] : $admin->email;
            DeliverNotification::dispatch($row->id, $channel, $phone, $email)->afterCommit();
        });
    }

    private function wantsOutside(Notice $notice): bool
    {
        $alert = AdminAlert::tryFrom($notice->event->value);
        $events = $this->settings->all()['alert_events'] ?? [];

        return $alert !== null && is_array($events) && in_array($alert->value, $events, true);
    }

    /** The bell row (null when this reminder was already given), sent live to the user. */
    private function bell(User $user, ?int $tenantId, Notice $notice, ?int $aboutTenant = null): ?UserNotification
    {
        try {
            $row = UserNotification::query()->create([
                'user_id' => $user->id,
                'tenant_id' => $tenantId ?? $aboutTenant,
                'event' => $notice->event,
                'title' => mb_substr($notice->title, 0, 200),
                'body' => mb_substr($notice->body, 0, 600),
                'link' => $notice->link,
                'payload' => $notice->payload(),
                'dedupe_key' => $notice->dedupeKey,
            ]);
        } catch (UniqueConstraintViolationException) {
            return null;
        }

        try {
            event(new NotificationCreated($user->id, $row->toBell()));
        } catch (Throwable $e) {
            // Realtime down: the bell loads it on the next open.
            report($e);
        }

        return $row;
    }

    private function safely(callable $work): void
    {
        try {
            $work();
        } catch (Throwable $e) {
            report($e);
        }
    }
}
