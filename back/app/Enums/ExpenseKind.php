<?php

declare(strict_types=1);

namespace App\Enums;

/** What a store expense was for (ads are matched to the orders' UTM source). */
enum ExpenseKind: string
{
    case Facebook = 'ads_facebook';
    case Tiktok = 'ads_tiktok';
    case Google = 'ads_google';
    case Snapchat = 'ads_snapchat';
    case OtherAds = 'ads_other';
    case Salaries = 'salaries';
    case Rent = 'rent';
    case Tools = 'tools';
    case Other = 'other';

    public function label(): string
    {
        return match ($this) {
            self::Facebook => 'إعلانات فيسبوك وانستجرام',
            self::Tiktok => 'إعلانات تيك توك',
            self::Google => 'إعلانات جوجل',
            self::Snapchat => 'إعلانات سناب شات',
            self::OtherAds => 'إعلانات تانية',
            self::Salaries => 'مرتبات',
            self::Rent => 'إيجار',
            self::Tools => 'أدوات واشتراكات',
            self::Other => 'مصاريف تانية',
        };
    }

    public function isAds(): bool
    {
        return str_starts_with($this->value, 'ads_');
    }

    /** The traffic sources this ad spend brings (TrafficSource::SOURCES; the first one names the row). @return list<string> */
    public function sources(): array
    {
        return match ($this) {
            self::Facebook => ['facebook', 'instagram'],
            self::Tiktok => ['tiktok'],
            self::Google => ['google', 'youtube'],
            self::Snapchat => ['snapchat'],
            default => [],
        };
    }

    /** @return list<string> */
    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }
}
