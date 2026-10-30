<?php

declare(strict_types=1);

namespace App\Enums;

enum WebhookKind: string
{
    case Webhook = 'webhook';
    /** Google Apps Script web app that writes orders into a sheet (no API key involved). */
    case GoogleSheets = 'google_sheets';
}
