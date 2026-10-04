<?php

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
