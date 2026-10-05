<?php

namespace App\Domain\Attendance\Enums;

use App\Domain\Attendance\Data\EmployeeRecap;
use InvalidArgumentException;

/**
 * Columns available to the payroll export (config/payroll_export.php).
 */
enum PayrollColumn: string
{
    case EmployeeNumber = 'employee_number';
    case Name = 'name';
    case Email = 'email';
    case Division = 'division';
    case Position = 'position';
    case Shift = 'shift';
    case WorkDays = 'work_days';
    case PresentDays = 'present_days';
    case LateCount = 'late_count';
    case LateMinutes = 'late_minutes';
    case EarlyLeaveCount = 'early_leave_count';
    case AbsentDays = 'absent_days';
    case LeaveDays = 'leave_days';
    case PermitDays = 'permit_days';
    case SickDays = 'sick_days';
    case BusinessTripDays = 'business_trip_days';
    case WfhDays = 'wfh_days';
    case NeedsCorrectionDays = 'needs_correction_days';
    case OvertimeHours = 'overtime_hours';
    case WorkHours = 'work_hours';
    case AttendanceRate = 'attendance_rate';
    case AverageCheckIn = 'average_check_in';

    public function label(): string
    {
        return match ($this) {
            self::EmployeeNumber => 'No. karyawan',
            self::Name => 'Nama',
            self::Email => 'Email',
            self::Division => 'Divisi',
            self::Position => 'Jabatan',
            self::Shift => 'Shift',
            self::WorkDays => 'Hari kerja',
            self::PresentDays => 'Hadir',
            self::LateCount => 'Terlambat (kali)',
            self::LateMinutes => 'Terlambat (menit)',
            self::EarlyLeaveCount => 'Pulang cepat (kali)',
            self::AbsentDays => 'Alpha',
            self::LeaveDays => 'Cuti',
            self::PermitDays => 'Izin',
            self::SickDays => 'Sakit',
            self::BusinessTripDays => 'Dinas',
            self::WfhDays => 'WFH',
            self::NeedsCorrectionDays => 'Perlu koreksi',
            self::OvertimeHours => 'Lembur (jam)',
            self::WorkHours => 'Jam kerja',
            self::AttendanceRate => 'Kehadiran (%)',
            self::AverageCheckIn => 'Rata-rata masuk',
        };
    }

    public function isText(): bool
    {
        return in_array($this, [self::EmployeeNumber, self::Name, self::Email, self::Division, self::Position, self::Shift, self::AverageCheckIn], true);
    }

    public function value(EmployeeRecap $recap): string|int|float|null
    {
        $user = $recap->user;

        return match ($this) {
            self::EmployeeNumber => $user->profile?->employee_number,
            self::Name => $user->name,
            self::Email => $user->email,
            self::Division => $user->division?->name,
            self::Position => $user->position?->name,
            self::Shift => $recap->shiftName,
            self::WorkDays => $recap->workDays,
            self::PresentDays => EmployeeRecap::days($recap->presentDays),
            self::LateCount => $recap->lateCount,
            self::LateMinutes => $recap->lateMinutes,
            self::EarlyLeaveCount => $recap->earlyLeaveCount,
            self::AbsentDays => $recap->absentDays,
            self::LeaveDays => EmployeeRecap::days($recap->leaveDays),
            self::PermitDays => EmployeeRecap::days($recap->permitDays),
            self::SickDays => $recap->sickDays,
            self::BusinessTripDays => $recap->businessTripDays,
            self::WfhDays => $recap->wfhDays,
            self::NeedsCorrectionDays => $recap->needsCorrectionDays,
            self::OvertimeHours => $recap->overtimeHours(),
            self::WorkHours => round($recap->workMinutes / 60, 1),
            self::AttendanceRate => $recap->attendanceRate(),
            self::AverageCheckIn => $recap->averageCheckInLabel(),
        };
    }

    /**
     * Configured columns with their headers, in order.
     *
     * @return list<array{0: self, 1: string}>
     *
     * @throws InvalidArgumentException for an unknown key
     */
    public static function configured(): array
    {
        $configured = config('payroll_export.columns');
        $columns = [];

        foreach (is_array($configured) ? $configured : [] as $key => $header) {
            $column = self::tryFrom((string) $key) ?? throw new InvalidArgumentException("Kolom ekspor payroll tidak dikenal: {$key}.");
            $columns[] = [$column, is_string($header) && $header !== '' ? $header : $column->label()];
        }

        if ($columns === []) {
            throw new InvalidArgumentException('config/payroll_export.php belum berisi kolom.');
        }

        return $columns;
    }
}
