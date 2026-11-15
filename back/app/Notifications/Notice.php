<?php

declare(strict_types=1);

namespace App\Notifications;

use App\Enums\NotificationEvent;

/**
 * One thing to tell: the bell text, the email copy (rows + button) and the WhatsApp copy
 * (an approved template key from WhatsAppTemplates with its values and the link-button value).
 */
final class Notice
{
    /**
     * @param  list<array{label: string, value: string}>  $rows
     * @param  list<string>  $whatsappParams
     */
    public function __construct(
        public readonly NotificationEvent $event,
        public readonly string $title,
        public readonly string $body,
        public readonly ?string $link = null,
        public readonly array $rows = [],
        public readonly ?string $action = null,
        public readonly ?string $whatsappTemplate = null,
        public readonly array $whatsappParams = [],
        public readonly ?string $whatsappButton = null,
        public readonly ?string $dedupeKey = null,
    ) {}

    /** @return array<string, mixed> */
    public function payload(): array
    {
        return [
            'rows' => $this->rows,
            'action' => $this->action,
            'whatsapp' => $this->whatsappTemplate === null ? null : [
                'template' => $this->whatsappTemplate,
                'params' => array_values(array_map(fn (string $v): string => self::param($v), $this->whatsappParams)),
                'button' => $this->whatsappButton,
            ],
        ];
    }

    /** Meta refuses new lines, tabs and 4+ spaces in a template value. */
    private static function param(string $value): string
    {
        $value = trim((string) preg_replace('/\s+/u', ' ', $value));

        return $value === '' ? '—' : mb_substr($value, 0, 200);
    }
}
