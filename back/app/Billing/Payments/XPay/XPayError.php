<?php

declare(strict_types=1);

namespace App\Billing\Payments\XPay;

use RuntimeException;

/** XPay refused a call or couldn't be reached (the message is safe to log, never shown as is to merchants). */
final class XPayError extends RuntimeException {}
