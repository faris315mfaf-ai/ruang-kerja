<?php

namespace App\Providers;

use App\Domain\Requests\Contracts\AttendanceEffects;
use App\Domain\Requests\Contracts\WorkingDayCalculator;
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
    ];
}
