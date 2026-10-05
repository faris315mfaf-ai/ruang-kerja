<?php

use App\Domain\Attendance\Jobs\PurgeExpiredSelfiesJob;
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
// Sprint 3 — selfie retention (monthly) and unscanned kiosk QR codes (daily).
Schedule::job(new PurgeExpiredSelfiesJob)->monthlyOn(1, '02:30')->timezone(config()->string('app.office_timezone'))->onOneServer();
Schedule::command('attendance:prune-qr-tokens')->dailyAt('03:10')->timezone(config()->string('app.office_timezone'))->withoutOverlapping()->onOneServer();
// Sprint 8 — notifications (office timezone, see config/notifications.php).
Schedule::command('notifications:send-daily-digests')->everyFiveMinutes()->withoutOverlapping();
Schedule::command('notifications:prune')->dailyAt('02:15')->timezone((string) config('app.office_timezone'));
