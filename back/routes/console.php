<?php

declare(strict_types=1);

use Illuminate\Support\Facades\Schedule;

Schedule::command('domains:verify-pending')->everyFiveMinutes()->withoutOverlapping();
Schedule::command('leads:prune')->daily();
