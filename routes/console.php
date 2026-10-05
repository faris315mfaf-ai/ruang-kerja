<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// Sprint 8 — notifications (office timezone, see config/notifications.php).
Schedule::command('notifications:send-daily-digests')->everyFiveMinutes()->withoutOverlapping();
Schedule::command('notifications:prune')->dailyAt('02:15')->timezone((string) config('app.office_timezone'));
