<?php

declare(strict_types=1);

namespace App\Enums;

/** Where an order's WhatsApp confirmation is (orders.confirm_state; null = none was sent). */
enum ConfirmState: string
{
    case Sent = 'sent';
    case Reminded = 'reminded';
    case Confirmed = 'confirmed';
    case Cancelled = 'cancelled';
    /** «عايز أكلم حد», or he wrote instead of pressing: the call center takes it. */
    case NeedsCall = 'needs_call';
    case NoReply = 'no_reply';
    /** The message couldn't reach him (no WhatsApp on the number, Meta refused). */
    case Failed = 'failed';

    public function label(): string
    {
        return match ($this) {
            self::Sent, self::Reminded => 'مستني رده على واتساب',
            self::Confirmed => 'أكّد على واتساب',
            self::Cancelled => 'لغى على واتساب',
            self::NeedsCall => 'عايز حد يكلمه',
            self::NoReply => 'ماردّش على واتساب',
            self::Failed => 'رسالة واتساب ماوصلتش',
        };
    }

    /** Still waiting for the customer's answer. */
    public function open(): bool
    {
        return $this === self::Sent || $this === self::Reminded;
    }

    /** @return list<string> */
    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }
}
