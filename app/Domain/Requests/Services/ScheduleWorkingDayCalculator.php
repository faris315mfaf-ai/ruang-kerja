<?php

namespace App\Domain\Requests\Services;

use App\Domain\Attendance\Models\Holiday;
use App\Domain\Attendance\Models\ShiftAssignment;
use App\Domain\Attendance\Services\ScheduleResolver;
use App\Domain\Requests\Contracts\WorkingDayCalculator;
use App\Models\User;
use Carbon\CarbonImmutable;

/**
 * Working days from the attendance schedule (Sprint 2): a date counts when the
 * employee's shift pattern / date override makes it a workday — holidays and
 * days off excluded. Employees without any shift assignment (e.g. Direksi)
 * fall back to Monday–Friday minus company holidays.
 */
final class ScheduleWorkingDayCalculator implements WorkingDayCalculator
{
    public function __construct(private readonly ScheduleResolver $schedules) {}

    public function workingDates(User $user, CarbonImmutable $from, CarbonImmutable $to): array
    {
        $from = ScheduleResolver::officeDate($from);
        $to = ScheduleResolver::officeDate($to);

        if (! ShiftAssignment::query()->where('user_id', $user->id)->exists()) {
            return $this->weekdaysWithoutHolidays($user, $from, $to);
        }

        $dates = [];

        for ($day = $from; $day->lte($to); $day = $day->addDay()) {
            if ($this->schedules->forDate($user, $day)->isWorkday()) {
                $dates[] = $day->toDateString();
            }
        }

        return $dates;
    }

    /**
     * @return list<string>
     */
    private function weekdaysWithoutHolidays(User $user, CarbonImmutable $from, CarbonImmutable $to): array
    {
        $holidays = Holiday::query()
            ->where('company_id', $user->company_id)
            ->whereDate('date', '>=', $from->toDateString())
            ->whereDate('date', '<=', $to->toDateString())
            ->get()
            ->map(fn (Holiday $holiday): string => $holiday->date->toDateString())
            ->all();

        $dates = [];

        for ($day = $from; $day->lte($to); $day = $day->addDay()) {
            if (! $day->isWeekend() && ! in_array($day->toDateString(), $holidays, true)) {
                $dates[] = $day->toDateString();
            }
        }

        return $dates;
    }
}
