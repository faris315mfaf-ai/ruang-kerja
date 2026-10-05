<?php

namespace App\Domain\Requests\Contracts;

use App\Models\User;
use Carbon\CarbonImmutable;

/**
 * Which office dates count as working days for a person (leave day counting).
 *
 * Default binding: Monday–Friday (WeekdayWorkingDayCalculator). The attendance
 * module provides the real one (shift assignments minus holidays).
 */
interface WorkingDayCalculator
{
    /**
     * Working office dates (Y-m-d) between $from and $to inclusive, ascending.
     *
     * @return list<string>
     */
    public function workingDates(User $user, CarbonImmutable $from, CarbonImmutable $to): array;

    /**
     * Whether the person's shift on the office date runs past midnight (night
     * shift): an attendance correction may then check out "before" checking in.
     */
    public function crossesMidnight(User $user, CarbonImmutable $date): bool;
}
