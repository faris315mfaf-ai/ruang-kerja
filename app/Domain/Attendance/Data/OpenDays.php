<?php

namespace App\Domain\Attendance\Data;

use App\Domain\Attendance\Models\AttendanceDay;

/**
 * Result of OpenDayLocator: the day awaiting check-out and the most recent day
 * already checked out within the window.
 */
final readonly class OpenDays
{
    public function __construct(
        public ?AttendanceDay $open,
        public ?AttendanceDay $checkedOut,
    ) {}
}
