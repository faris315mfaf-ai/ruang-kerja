<?php

namespace App\Domain\Attendance\Data;

/**
 * Monthly recap of many employees plus the company calendar of the month.
 */
final readonly class RecapReport
{
    /**
     * @param  list<EmployeeRecap>  $rows
     */
    public function __construct(
        public RecapPeriod $period,
        public array $rows,
        public int $calendarWorkDays,
        public int $weekendDays,
        public int $holidayDays,
    ) {}

    public function totalLateCount(): int
    {
        return array_sum(array_map(fn (EmployeeRecap $row): int => $row->lateCount, $this->rows));
    }

    public function totalOvertimeHours(): float
    {
        return round(array_sum(array_map(fn (EmployeeRecap $row): int => $row->overtimeMinutes, $this->rows)) / 60, 1);
    }

    /**
     * Present ÷ expected days over everyone (requests excluded).
     */
    public function attendanceRate(): ?float
    {
        $present = array_sum(array_map(fn (EmployeeRecap $row): float => $row->presentDays, $this->rows));
        $expected = array_sum(array_map(fn (EmployeeRecap $row): float => $row->expectedDays(), $this->rows));

        return $expected <= 0 ? null : round(min(100, $present / $expected * 100), 1);
    }
}
