<?php

declare(strict_types=1);

namespace App\Enums;

/** What the customer gives on a «حسب الطلب» field. */
enum ProductInputKind: string
{
    case Text = 'text';
    case Textarea = 'textarea';
    case Image = 'image';
    case File = 'file';

    public function label(): string
    {
        return match ($this) {
            self::Text => 'نص قصير',
            self::Textarea => 'نص طويل',
            self::Image => 'رفع صورة',
            self::File => 'رفع ملف',
        };
    }

    public function isUpload(): bool
    {
        return $this === self::Image || $this === self::File;
    }

    /** The longest text the customer can type. */
    public function maxLength(): int
    {
        return $this === self::Textarea ? 1000 : 200;
    }

    /** @return list<string> */
    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }
}
