<?php

use App\Domain\Attendance\Jobs\SendCheckInReminders;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// Sprint 2 — attendance (office timezone).
Schedule::command('attendance:close-day')->dailyAt('00:30')->timezone(config()->string('app.office_timezone'))->withoutOverlapping()->onOneServer();
Schedule::job(new SendCheckInReminders)->everyFiveMinutes()->withoutOverlapping()->onOneServer();
