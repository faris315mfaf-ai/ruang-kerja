<?php

namespace App\Domain\Attendance\Data;

use App\Models\User;

/**
 * Monthly numbers of one employee (docs/PRD.md M2 "Rekap & ekspor").
 * `presentDays` already includes late days ("Terlambat … sudah termasuk dalam Hadir").
 */
final class EmployeeRecap
{
    public int $workDays = 0;

    public int $presentDays = 0;

    public int $lateCount = 0;

    public int $lateMinutes = 0;

    public int $earlyLeaveCount = 0;

    public int $absentDays = 0;

    public int $leaveDays = 0;

    public int $permitDays = 0;

    public int $sickDays = 0;

    public int $businessTripDays = 0;

    public int $wfhDays = 0;

    public int $needsCorrectionDays = 0;

    public int $offDays = 0;

    public int $overtimeMinutes = 0;

    public int $workMinutes = 0;

    public int $suspiciousDays = 0;

    /** Average check-in, minutes after office midnight (null without check-ins). */
    public ?int $averageCheckInMinute = null;

    /** @var list<RecapDay> */
    public array $days = [];

    public function __construct(public readonly User $user) {}

    public function overtimeHours(): float
    {
        return round($this->overtimeMinutes / 60, 1);
    }

    /**
     * Days the employee was expected to be at work (requests excluded).
     */
    public function expectedDays(): int
    {
        return max(0, $this->workDays - $this->leaveDays - $this->permitDays - $this->sickDays - $this->businessTripDays);
    }

    public function attendanceRate(): ?float
    {
        $expected = $this->expectedDays();

        return $expected === 0 ? null : round(min(100, $this->presentDays / $expected * 100), 1);
    }

    public function averageCheckInLabel(): ?string
    {
        if ($this->averageCheckInMinute === null) {
            return null;
        }

        return sprintf('%02d.%02d', intdiv($this->averageCheckInMinute, 60), $this->averageCheckInMinute % 60);
    }
}
