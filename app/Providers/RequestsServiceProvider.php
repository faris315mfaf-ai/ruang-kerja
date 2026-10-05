<?php

namespace App\Providers;

use App\Domain\Notifications\Contracts\UserAvailability;
use App\Domain\Requests\Contracts\AttendanceEffects;
use App\Domain\Requests\Contracts\WorkingDayCalculator;
use App\Domain\Requests\Services\ApprovedLeaveAvailability;
use App\Domain\Requests\Services\AttendanceDayEffects;
use App\Domain\Requests\Services\ScheduleWorkingDayCalculator;
use Illuminate\Support\ServiceProvider;

/**
 * Bindings of the requests module (Sprint 4) to the attendance module.
 */
class RequestsServiceProvider extends ServiceProvider
{
    /** @var array<class-string, class-string> */
    public array $bindings = [
        // Attendance module (Sprint 2): shift schedule + holidays, attendance_days.
        WorkingDayCalculator::class => ScheduleWorkingDayCalculator::class,
        AttendanceEffects::class => AttendanceDayEffects::class,
        // Sprint 8: "hold notifications while on leave" and the daily digest.
        UserAvailability::class => ApprovedLeaveAvailability::class,
    ];
}
