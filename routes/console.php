<?php

use App\Domain\Attendance\Jobs\SendCheckInReminders;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// Requests & approvals (Sprint 4), office timezone.
Schedule::command('requests:generate-balances')
    ->yearlyOn(1, 1, '00:05')
    ->timezone(config()->string('app.office_timezone', 'Asia/Jakarta'))
    ->withoutOverlapping()
    ->onOneServer();

Schedule::command('requests:route-delegations')
    ->dailyAt('00:10')
    ->timezone(config()->string('app.office_timezone', 'Asia/Jakarta'))
    ->withoutOverlapping()
    ->onOneServer();
// Sprint 2 — attendance (office timezone).
Schedule::command('attendance:close-day')->dailyAt('00:30')->timezone(config()->string('app.office_timezone'))->withoutOverlapping()->onOneServer();
Schedule::job(new SendCheckInReminders)->everyFiveMinutes()->withoutOverlapping()->onOneServer();
// Sprint 8 — notifications (office timezone, see config/notifications.php).
Schedule::command('notifications:send-daily-digests')->everyFiveMinutes()->withoutOverlapping();
Schedule::command('notifications:prune')->dailyAt('02:15')->timezone((string) config('app.office_timezone'));

// Sprint 6 — task deadline reminders (H-1 & overdue), office timezone.
Schedule::command('tasks:notify-deadlines')->dailyAt('07:00')->timezone((string) config('app.office_timezone'))->withoutOverlapping()->onOneServer();

// Sprint 1 — uploaded employee import files contain NIK: never keep them past their session.
Schedule::command('employee-imports:prune')->hourly()->withoutOverlapping();
