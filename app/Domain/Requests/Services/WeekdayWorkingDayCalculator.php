<?php

namespace App\Domain\Requests\Services;

use App\Domain\Requests\Contracts\WorkingDayCalculator;
use App\Models\User;
use Carbon\CarbonImmutable;

/**
 * Fallback calendar: Monday–Friday are working days, no holidays.
 */
final class WeekdayWorkingDayCalculator implements WorkingDayCalculator
{
    public function workingDates(User $user, CarbonImmutable $from, CarbonImmutable $to): array
    {
        $dates = [];

        for ($day = $from->startOfDay(); $day->lte($to); $day = $day->addDay()) {
            if (! $day->isWeekend()) {
                $dates[] = $day->toDateString();
            }
        }

        return $dates;
    }
}
