<?php

declare(strict_types=1);

namespace App\Services;

use RuntimeException;

/** An upload that failed validation or processing; the message is user-facing Arabic. */
final class MediaRejected extends RuntimeException {}
