<?php

declare(strict_types=1);

namespace App\Ai\Copilot\Resources;

use App\Ai\Copilot\Contracts\CopilotResource;
use App\Ai\Copilot\Contracts\Field;
use App\Enums\StoreMailMode;
use App\Models\StoreMailSetting;
use Illuminate\Database\Eloquent\Model;

/** «إعدادات الإيميلات» (read only: the mailbox password is typed by the merchant on the settings page only). */
final class MailSettingsResource extends CopilotResource
{
    public function key(): string
    {
        return 'mail_settings';
    }

    public function label(): string
    {
        return 'إعدادات الإيميلات';
    }

    public function summary(): string
    {
        return 'How the store\'s customer emails go out (at most one row; no row = the default): mode platform = from the platform\'s address with the store\'s name as sender and replies to the merchant (default), smtp = from the merchant\'s own mailbox (Gmail, Outlook… with an app password; if it fails, emails go from the platform and the merchant is told). Status failed + last_error = his mailbox is refusing. Changed on /dashboard/settings/emails.';
    }

    public function model(): string
    {
        return StoreMailSetting::class;
    }

    public function fields(): array
    {
        return [
            Field::enum('mode', StoreMailMode::class)->label('طريقة الإرسال')->labels(['platform' => 'من إيميل المنصة باسم المتجر', 'smtp' => 'من إيميل التاجر'])->filterable(),
            Field::text('sender_name')->label('اسم الراسل'),
            Field::text('reply_to')->label('الردود بتروح لـ'),
            Field::text('smtp_host')->label('سيرفر الإيميل'),
            Field::text('from_address')->label('بيتبعت من')->using(fn (StoreMailSetting $s) => $s->usesSmtp() ? $s->fromAddress() : (string) config('mail.from.address')),
            Field::text('status')->label('الحالة'),
            Field::text('last_error')->label('آخر مشكلة'),
            Field::date('checked_at')->label('آخر فحص'),
        ];
    }

    public function url(?Model $row): ?string
    {
        return '/dashboard/settings/emails';
    }
}
