<?php

namespace App\Domain\Notifications\Support;

use App\Domain\Notifications\Contracts\WorkdayCalendar;
use Carbon\CarbonImmutable;

final class WeekdayCalendar implements WorkdayCalendar
{
    public function isWorkday(CarbonImmutable $date): bool
    {
        /** @var list<int> $workdays */
        $workdays = config('notifications.digest.workdays', [1, 2, 3, 4, 5]);

        return in_array($date->dayOfWeekIso, $workdays, true);
    }
}
