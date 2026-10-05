<?php

namespace App\Http\Resources\Attendance;

use App\Domain\Attendance\Data\EmployeeRecap;
use App\Domain\Attendance\Data\RecapDay;
use App\Domain\Attendance\Data\RecapPeriod;
use App\Domain\Attendance\Data\RecapReport;
use App\Domain\Attendance\Enums\LogFlag;
use App\Domain\Attendance\Models\AttendanceDay;
use App\Domain\Attendance\Models\AttendanceLog;
use App\Http\Resources\Attendance\Concerns\NamesPeople;
use App\Models\User;
use Illuminate\Support\Facades\Gate;

/**
 * Monthly recap → Inertia props (mockups RekapAbsensi, MRiwayatAbsensi).
 */
final class RecapPresenter
{
    use NamesPeople;

    public function __construct(private readonly AttendancePresenter $attendance) {}

    /**
     * @return array<string, mixed>
     */
    public function period(RecapPeriod $period): array
    {
        return [
            'month' => $period->key(),
            'label' => $period->label(),
            'start' => $period->monthStart->toDateString(),
            'end' => $period->monthEnd->toDateString(),
            'countedUntil' => $period->countedUntil?->toDateString(),
            'isRunning' => $period->isRunning(),
            'previous' => $period->monthStart->subMonth()->format('Y-m'),
            'next' => $period->monthStart->addMonth()->format('Y-m'),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function report(RecapReport $report): array
    {
        return [
            'summary' => [
                'employees' => count($report->rows),
                'calendarWorkDays' => $report->calendarWorkDays,
                'weekendDays' => $report->weekendDays,
                'holidayDays' => $report->holidayDays,
                'attendanceRate' => $report->attendanceRate(),
                'lateCount' => $report->totalLateCount(),
                'overtimeHours' => $report->totalOvertimeHours(),
                'lateToleranceMin' => config()->integer('attendance.schedule.default_late_tolerance_min'),
            ],
            'rows' => array_map(fn (EmployeeRecap $row): array => $this->row($row), $report->rows),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function row(EmployeeRecap $recap): array
    {
        $user = $recap->user;

        return [
            'userId' => $user->id,
            'name' => $user->name,
            'initials' => self::initials($user->name),
            'divisionName' => $user->division?->name,
            'positionName' => $user->position?->name,
            'shiftName' => $recap->shiftName,
            'workDays' => $recap->workDays,
            'presentDays' => $recap->presentDays,
            'lateCount' => $recap->lateCount,
            'lateMinutes' => $recap->lateMinutes,
            'earlyLeaveCount' => $recap->earlyLeaveCount,
            'absentDays' => $recap->absentDays,
            'leaveDays' => $recap->leaveDays,
            'permitDays' => $recap->permitDays,
            'sickDays' => $recap->sickDays,
            'businessTripDays' => $recap->businessTripDays,
            'wfhDays' => $recap->wfhDays,
            'needsCorrectionDays' => $recap->needsCorrectionDays,
            'offDays' => $recap->offDays,
            'overtimeHours' => $recap->overtimeHours(),
            'attendanceRate' => $recap->attendanceRate(),
            'averageCheckIn' => $recap->averageCheckInLabel(),
            'suspiciousDays' => $recap->suspiciousDays,
        ];
    }

    /**
     * One employee's month: numbers, calendar cells and the logs of the month.
     *
     * @return array<string, mixed>
     */
    public function detail(EmployeeRecap $recap, RecapPeriod $period, User $viewer): array
    {
        $logs = AttendanceLog::query()
            ->with(['officeLocation', 'user'])
            ->where('user_id', $recap->user->id)
            // Logs of the work dates of the month (an overnight check-out on the 1st belongs to the 30th).
            ->whereIn('attendance_day_id', AttendanceDay::query()
                ->select('id')
                ->where('user_id', $recap->user->id)
                ->whereBetween('work_date', [$period->monthStart->toDateString(), $period->monthEnd->toDateString()]))
            ->orderBy('occurred_at')
            ->get();

        return [
            ...$this->row($recap),
            'days' => array_map(fn (RecapDay $cell): array => $this->cell($cell), $recap->days),
            'logs' => array_values($logs->map(fn (AttendanceLog $log): array => $this->log($log, $viewer))->all()),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function cell(RecapDay $cell): array
    {
        $day = $cell->day;

        return [
            'date' => $cell->date,
            'kind' => $cell->kind,
            'isWorkday' => $cell->isWorkday,
            'holidayName' => $cell->holidayName,
            'dayId' => $day?->id,
            'statusLabel' => $day?->status->label(),
            'lateMinutes' => $day->late_minutes ?? 0,
            'earlyLeaveMinutes' => $day->early_leave_minutes ?? 0,
            'workMinutes' => $day->work_minutes ?? 0,
            'overtimeMinutes' => $day->overtime_minutes ?? 0,
            'isSuspicious' => $day->is_suspicious ?? false,
            'shiftName' => $day?->shift?->name,
            'checkIn' => $day?->checkInLog === null ? null : $this->attendance->log($day->checkInLog),
            'checkOut' => $day?->checkOutLog === null ? null : $this->attendance->log($day->checkOutLog),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function log(AttendanceLog $log, User $viewer): array
    {
        return [
            ...$this->attendance->log($log),
            'typeLabel' => $log->type->label(),
            'accuracyM' => $log->accuracy_m === null ? null : (int) round($log->accuracy_m),
            'flags' => $log->flags->map(fn (LogFlag $flag): array => ['value' => $flag->value, 'label' => $flag->label()])->values()->all(),
            'reviewedAt' => AttendancePresenter::iso($log->reviewed_at),
            'isCorrection' => $log->corrected_by !== null,
            'hasSelfie' => $log->selfie_path !== null,
            'canViewSelfie' => $log->selfie_path !== null && Gate::forUser($viewer)->allows('viewSelfie', $log),
            'canReview' => $log->is_suspicious && $log->reviewed_at === null && Gate::forUser($viewer)->allows('review', $log),
        ];
    }
}
