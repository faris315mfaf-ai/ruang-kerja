<?php

namespace App\Domain\Attendance\Support;

use App\Domain\Attendance\Models\Holiday;
use App\Domain\Notifications\Contracts\WorkdayCalendar;
use App\Domain\Notifications\Support\WeekdayCalendar;
use Carbon\CarbonImmutable;

/**
 * Workdays for the daily digest (Sprint 8 contract): configured weekdays minus
 * the holidays HR maintains in Admin › Lokasi, shift & hari libur. Phase 1 has
 * a single company, so any holiday row on the date counts.
 */
final class HolidayAwareWorkdayCalendar implements WorkdayCalendar
{
    public function __construct(private readonly WeekdayCalendar $weekdays) {}

    public function isWorkday(CarbonImmutable $date): bool
    {
        return $this->weekdays->isWorkday($date)
            && ! Holiday::query()->whereDate('date', $date->toDateString())->exists();
    }
}
