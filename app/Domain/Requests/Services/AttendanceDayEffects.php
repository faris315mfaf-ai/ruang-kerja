<?php

namespace App\Domain\Requests\Services;

use App\Domain\Attendance\Actions\CheckOut;
use App\Domain\Attendance\Data\DaySchedule;
use App\Domain\Attendance\Enums\AttendanceStatus;
use App\Domain\Attendance\Enums\RequestPortion;
use App\Domain\Attendance\Models\AttendanceDay;
use App\Domain\Attendance\Services\ScheduleResolver;
use App\Domain\Organization\Enums\WorkMode;
use App\Domain\Organization\Services\AuditLogger;
use App\Domain\Requests\Contracts\AttendanceEffects;
use App\Domain\Requests\Support\OfficeTime;
use App\Models\EmployeeRequest;
use Carbon\CarbonImmutable;

/**
 * Writes approved requests into attendance_days (ARCHITECTURE §3.4).
 *
 * - Absence (cuti/izin/sakit/dinas): every working date gets the category
 *   status + request_id + request_portion (full / half_day), so closing the
 *   day never marks it `absent`. Half days and business trips still allow a
 *   check-in (the status and request link stay). Days the employee already
 *   checked in on keep their attendance.
 * - Overtime: overtime_minutes = sum of approved overtime of that work date
 *   (ApprovedOvertime); a day without an attendance row is synced when it is
 *   closed (CloseAttendanceDay).
 * - Correction: applies the requested check-in/out times, recomputes status,
 *   late/early minutes and work minutes; audited as `attendance_day.corrected`.
 */
final class AttendanceDayEffects implements AttendanceEffects
{
    public function __construct(
        private readonly ScheduleResolver $schedules,
        private readonly ApprovedOvertime $overtime,
        private readonly AuditLogger $audit,
    ) {}

    public function applyAbsence(EmployeeRequest $request, array $workDates): void
    {
        $request->loadMissing(['user', 'leaveType']);
        $status = AttendanceStatus::tryFrom((string) $request->leaveType->category->attendanceStatus());

        if ($status === null) {
            return;
        }

        $halfDay = (bool) ($request->payload['half_day'] ?? false);
        $portion = $halfDay ? RequestPortion::HalfDay : RequestPortion::Full;
        $note = trim($request->leaveType->name.' '.($request->number ?? '').($halfDay ? ' (setengah hari)' : ''));

        foreach ($workDates as $date) {
            $day = $this->lockedDay($request->user_id, $date);

            if ($day !== null && $day->check_in_at !== null) {
                // Came to work after all: attendance wins. A half day or a business
                // trip is still linked to its request; a business trip is shown as
                // "Dinas", a half day keeps the attendance status (never an absence).
                if ($halfDay || $status === AttendanceStatus::BusinessTrip) {
                    $day->fill([
                        'request_id' => $request->id,
                        'request_portion' => $portion,
                        'status' => $status === AttendanceStatus::BusinessTrip ? $status : $day->status,
                        'note' => trim(($day->note ?? '').' '.$note),
                    ])->save();
                }

                continue;
            }

            $schedule = $this->schedules->forDate($request->user, ScheduleResolver::parseDate($date));
            $day ??= new AttendanceDay(['user_id' => $request->user_id, 'work_date' => $date]);

            $day->fill([
                'status' => $status,
                'request_id' => $request->id,
                'request_portion' => $portion,
                'shift_id' => $schedule->isWorkday() ? $schedule->shift?->id : null,
                'scheduled_start' => $schedule->scheduledStart,
                'scheduled_end' => $schedule->scheduledEnd,
                'note' => $note,
            ])->save();
        }
    }

    public function applyOvertime(EmployeeRequest $request): void
    {
        $date = $request->payload['date'] ?? null;

        if (! is_string($date)) {
            return;
        }

        $this->syncOvertime($request->user_id, $date);
    }

    public function applyCorrection(EmployeeRequest $request): void
    {
        $request->loadMissing('user');
        $payload = $request->payload;
        $date = $payload['date'] ?? null;

        if (! is_string($date)) {
            return;
        }

        $checkIn = is_string($payload['check_in'] ?? null) ? $payload['check_in'] : null;
        $checkOut = is_string($payload['check_out'] ?? null) ? $payload['check_out'] : null;
        $schedule = $this->schedules->forDate($request->user, ScheduleResolver::parseDate($date));
        $day = $this->lockedDay($request->user_id, $date) ?? new AttendanceDay(['user_id' => $request->user_id, 'work_date' => $date]);
        $before = $day->exists ? self::snapshot($day) : null;

        $inAt = $checkIn !== null ? OfficeTime::at($date, $checkIn) : $day->check_in_at;
        $outAt = $checkOut !== null ? OfficeTime::at($date, $checkOut) : $day->check_out_at;

        if ($inAt !== null && $outAt !== null && $outAt->lte($inAt)) {
            $outAt = $outAt->addDay(); // overnight shift
        }

        $day->fill([
            'shift_id' => $schedule->isWorkday() ? $schedule->shift?->id : $day->shift_id,
            'scheduled_start' => $schedule->scheduledStart ?? $day->scheduled_start,
            'scheduled_end' => $schedule->scheduledEnd ?? $day->scheduled_end,
            'check_in_at' => $inAt,
            'check_out_at' => $outAt,
            'note' => trim('Dikoreksi lewat '.($request->number ?? 'pengajuan').'. '.($day->note ?? '')),
        ]);

        $late = self::lateMinutes($schedule, $inAt);
        $early = $outAt !== null ? CheckOut::earlyLeaveMinutes($day, CarbonImmutable::instance($outAt)) : 0;

        $day->fill([
            'late_minutes' => $late,
            'early_leave_minutes' => $early,
            'work_minutes' => $outAt !== null ? CheckOut::workMinutes($day, CarbonImmutable::instance($outAt)) : 0,
            'status' => self::status($schedule, $day, $late, $early, $outAt !== null),
        ])->save();

        $this->audit->log('attendance_day.corrected', $day, $before, [...self::snapshot($day), 'request_id' => $request->id]);
    }

    public function revert(EmployeeRequest $request): void
    {
        $request->loadMissing('leaveType');

        if ($request->leaveType->category->isAbsence()) {
            // Rows written for the request return to "not closed yet"; the next close-day run re-evaluates them.
            AttendanceDay::query()->where('request_id', $request->id)->whereNull('check_in_at')->delete();

            // Days worked anyway (half day, business trip) become ordinary attendance.
            AttendanceDay::query()->where('request_id', $request->id)->get()->each(function (AttendanceDay $day): void {
                $day->fill([
                    'request_id' => null,
                    'request_portion' => null,
                    'status' => $day->status->comesFromRequest()
                        ? ($day->late_minutes > 0 ? AttendanceStatus::Late : AttendanceStatus::Present)
                        : $day->status,
                ])->save();
            });

            return;
        }

        $date = $request->payload['date'] ?? null;

        if (is_string($date) && $request->minutes !== null) {
            $this->syncOvertime($request->user_id, $date);
        }

        // Corrections cannot be undone automatically (the original times are in the audit log).
    }

    /**
     * overtime_minutes of an existing attendance row = approved overtime of that date.
     */
    public function syncOvertime(string $userId, string $date): void
    {
        $day = $this->lockedDay($userId, $date);

        if ($day === null) {
            return;
        }

        $day->overtime_minutes = $this->overtime->minutesFor($userId, $date);

        if ($day->isDirty('overtime_minutes')) {
            $day->save();
        }
    }

    private function lockedDay(string $userId, string $date): ?AttendanceDay
    {
        return AttendanceDay::query()
            ->where('user_id', $userId)
            ->whereDate('work_date', $date)
            ->lockForUpdate()
            ->first();
    }

    private static function lateMinutes(DaySchedule $schedule, ?CarbonImmutable $checkIn): int
    {
        $threshold = $schedule->isWorkday() ? $schedule->lateThreshold() : null;

        if ($threshold === null || $checkIn === null) {
            return 0;
        }

        $seconds = $checkIn->getTimestamp() - $threshold->getTimestamp();

        return $seconds <= 0 ? 0 : intdiv($seconds, 60);
    }

    private static function status(DaySchedule $schedule, AttendanceDay $day, int $late, int $early, bool $checkedOut): AttendanceStatus
    {
        if ($day->check_in_at === null) {
            return $checkedOut ? AttendanceStatus::NeedsCorrection : ($day->status ?? AttendanceStatus::Absent);
        }

        $base = $late > 0
            ? AttendanceStatus::Late
            : (($day->exists && $day->getRawOriginal('status') === AttendanceStatus::Wfh->value) || $schedule->workMode === WorkMode::Wfh ? AttendanceStatus::Wfh : AttendanceStatus::Present);

        if (! $checkedOut) {
            return $base;
        }

        return $early > 0 && in_array($base, [AttendanceStatus::Present, AttendanceStatus::Wfh], true) ? AttendanceStatus::EarlyLeave : $base;
    }

    /**
     * @return array<string, mixed>
     */
    private static function snapshot(AttendanceDay $day): array
    {
        return [
            'status' => $day->status->value,
            'check_in_at' => $day->check_in_at?->toIso8601String(),
            'check_out_at' => $day->check_out_at?->toIso8601String(),
            'late_minutes' => $day->late_minutes,
            'early_leave_minutes' => $day->early_leave_minutes,
        ];
    }
}
