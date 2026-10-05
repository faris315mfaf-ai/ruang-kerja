<?php

namespace App\Domain\Attendance\Enums;

/**
 * Daily attendance status (attendance_days.status). UI labels per docs/PRD.md M2.
 */
enum AttendanceStatus: string
{
    case Present = 'present';
    case Late = 'late';
    case EarlyLeave = 'early_leave';
    case Absent = 'absent';
    case Leave = 'leave';
    case Permit = 'permit';
    case Sick = 'sick';
    case BusinessTrip = 'business_trip';
    case Holiday = 'holiday';
    case Wfh = 'wfh';
    case NeedsCorrection = 'needs_correction';

    public function label(): string
    {
        return match ($this) {
            self::Present => 'Hadir',
            self::Late => 'Terlambat',
            self::EarlyLeave => 'Pulang cepat',
            self::Absent => 'Alpha',
            self::Leave => 'Cuti',
            self::Permit => 'Izin',
            self::Sick => 'Sakit',
            self::BusinessTrip => 'Dinas',
            self::Holiday => 'Libur',
            self::Wfh => 'WFH',
            self::NeedsCorrection => 'Perlu koreksi',
        };
    }

    /**
     * Statuses written from an approved request (Sprint 4). Closing a day never
     * overrides them.
     */
    public function comesFromRequest(): bool
    {
        return in_array($this, [self::Leave, self::Permit, self::Sick, self::BusinessTrip], true);
    }

    /**
     * The employee was at work (in the office, WFH or in the field).
     */
    public function isAttended(): bool
    {
        return in_array($this, [self::Present, self::Late, self::EarlyLeave, self::Wfh], true);
    }
}
