<?php

namespace App\Providers;

use App\Domain\Notifications\Contracts\UserAvailability;
use App\Domain\Requests\Contracts\AttendanceEffects;
use App\Domain\Requests\Contracts\WorkingDayCalculator;
use App\Domain\Requests\Services\ApprovedLeaveAvailability;
use App\Domain\Requests\Services\NullAttendanceEffects;
use App\Domain\Requests\Services\WeekdayWorkingDayCalculator;
use Illuminate\Support\ServiceProvider;

/**
 * Bindings of the requests module (Sprint 4) to the attendance module.
 */
class RequestsServiceProvider extends ServiceProvider
{
    /** @var array<class-string, class-string> */
    public array $bindings = [
        WorkingDayCalculator::class => WeekdayWorkingDayCalculator::class,
        AttendanceEffects::class => NullAttendanceEffects::class,
        // Sprint 8: "hold notifications while on leave" and the daily digest.
        UserAvailability::class => ApprovedLeaveAvailability::class,
    ];
}
