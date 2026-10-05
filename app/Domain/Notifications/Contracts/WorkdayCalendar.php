<?php

namespace App\Domain\Notifications\Contracts;

use Carbon\CarbonImmutable;

/**
 * Decides whether the daily digest goes out on a given office-local date.
 * Default: weekdays from config notifications.digest.workdays. The Attendance
 * module may bind a holiday-aware implementation.
 */
interface WorkdayCalendar
{
    public function isWorkday(CarbonImmutable $date): bool;
}
