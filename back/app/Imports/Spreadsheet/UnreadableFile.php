<?php

declare(strict_types=1);

namespace App\Imports\Spreadsheet;

use RuntimeException;

/** The uploaded file cannot be read as a sheet; the message is a key under imports.* translations. */
final class UnreadableFile extends RuntimeException {}
