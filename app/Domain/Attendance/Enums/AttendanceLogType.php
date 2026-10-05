<?php

namespace App\Domain\Attendance\Enums;

enum AttendanceLogType: string
{
    case CheckIn = 'check_in';
    case CheckOut = 'check_out';

    public function label(): string
    {
        return match ($this) {
            self::CheckIn => 'Check-in',
            self::CheckOut => 'Check-out',
        };
    }
}
