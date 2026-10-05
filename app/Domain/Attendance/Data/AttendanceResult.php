<?php

namespace App\Domain\Attendance\Data;

use App\Domain\Attendance\Models\AttendanceDay;
use App\Domain\Attendance\Models\AttendanceLog;

final readonly class AttendanceResult
{
    public function __construct(
        public AttendanceDay $day,
        public AttendanceLog $log,
        public DaySchedule $schedule,
        public LocationVerdict $location,
    ) {}
}
