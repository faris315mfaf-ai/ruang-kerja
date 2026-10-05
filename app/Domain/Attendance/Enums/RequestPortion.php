<?php

namespace App\Domain\Attendance\Enums;

/**
 * How much of a work date an approved absence request covers
 * (attendance_days.request_portion). A half day still expects the employee
 * at work for the other half, so check-in stays possible.
 */
enum RequestPortion: string
{
    case Full = 'full';
    case HalfDay = 'half_day';

    public function label(): string
    {
        return match ($this) {
            self::Full => 'Sehari penuh',
            self::HalfDay => 'Setengah hari',
        };
    }
}
