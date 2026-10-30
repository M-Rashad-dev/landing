<?php

declare(strict_types=1);

namespace App\Enums;

/** Running: visitors are split. Finished: a winner (if B) keeps getting the entry link's traffic. */
enum AbTestStatus: string
{
    case Running = 'running';
    case Finished = 'finished';
}
