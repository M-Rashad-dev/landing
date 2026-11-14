<?php

declare(strict_types=1);

use Illuminate\Support\Facades\Schedule;

Schedule::command('domains:verify-pending')->everyFiveMinutes()->withoutOverlapping();
Schedule::command('leads:prune')->daily();
Schedule::command('imports:prune')->daily();
Schedule::command('support:close-idle')->everyFiveMinutes()->withoutOverlapping();
Schedule::command('subscriptions:sweep')->everyMinute()->withoutOverlapping();
Schedule::command('invoices:expire')->hourly()->withoutOverlapping();
Schedule::command('admin:daily-summary')->dailyAt('09:00')->timezone('Africa/Cairo');
