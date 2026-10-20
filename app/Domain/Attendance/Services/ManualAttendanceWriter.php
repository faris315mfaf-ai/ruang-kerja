<?php

namespace App\Domain\Attendance\Services;

use App\Domain\Attendance\Actions\CheckIn;
use App\Domain\Attendance\Actions\CheckOut;
use App\Domain\Attendance\Data\DaySchedule;
use App\Domain\Attendance\Enums\AttendanceLogType;
use App\Domain\Attendance\Enums\AttendanceMethod;
use App\Domain\Attendance\Enums\AttendanceStatus;
use App\Domain\Attendance\Models\AttendanceDay;
use App\Domain\Attendance\Models\AttendanceLog;
use App\Domain\Attendance\Support\OfficeClock;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Validation\ValidationException;

/**
 * Check-in/out times written by HR (CorrectAttendance, SetAttendanceStatus):
 * immutable logs with method `manual`, `corrected_by` and the reason as note,
 * then the day is recomputed with the same rules as a live check-in/out.
 * Call inside a transaction with the day row locked (or new).
 */
final class ManualAttendanceWriter
{
    /**
     * A full-day leave/permit/sick of an approved request is changed through
     * the request, not by hand. Half days and business trips expect work.
     *
     * @throws ValidationException
     */
    public static function assertNotRequestDay(AttendanceDay $day, string $field = 'work_date'): void
    {
        if ($day->exists && $day->status->comesFromRequest() && ! $day->isManual() && ! $day->allowsCheckInDespiteRequest()) {
            throw ValidationException::withMessages([
                $field => "Tanggal ini tercatat {$day->status->label()} dari pengajuan yang disetujui. Ubah lewat pengajuan.",
            ]);
        }
    }

    /**
     * Writes the given office times ("H:i", null = keep) on $day and
     * recomputes it. A manual status (status_source) is cleared: real times
     * decide again. Returns the logs written (check-in first).
     *
     * @return list<AttendanceLog>
     *
     * @throws ValidationException
     */
    public function apply(
        User $actor,
        User $employee,
        AttendanceDay $day,
        DaySchedule $schedule,
        ?string $checkInTime,
        ?string $checkOutTime,
        string $reason,
        CarbonImmutable $now,
    ): array {
        $workDate = $schedule->workDate;
        $checkIn = $checkInTime === null ? $day->check_in_at : self::at($workDate, $checkInTime, $schedule);
        $checkOut = $checkOutTime === null ? $day->check_out_at : self::at($workDate, $checkOutTime, $schedule);

        if ($checkIn === null) {
            throw ValidationException::withMessages(['check_in' => 'Isi jam masuk: tanggal ini belum punya check-in.']);
        }

        // A new check-out at or before the check-in belongs to the next day (overnight shift).
        if ($checkOutTime !== null && $checkOut !== null && $checkOut->lte($checkIn)) {
            $checkOut = $checkOut->addDay();
        }

        if ($checkOut !== null && $checkOut->lte($checkIn)) {
            throw ValidationException::withMessages(['check_out' => 'Jam pulang harus setelah jam masuk.']);
        }

        foreach (['check_in' => $checkInTime === null ? null : $checkIn, 'check_out' => $checkOutTime === null ? null : $checkOut] as $field => $instant) {
            if ($instant !== null && $instant->gt($now)) {
                throw ValidationException::withMessages([$field => 'Jam koreksi tidak boleh melewati waktu sekarang.']);
            }
        }

        $remote = $day->exists && $day->checkInLog?->method === AttendanceMethod::Wfh;

        if (! $day->exists || $day->scheduled_start === null) {
            $day->fill([
                'shift_id' => $schedule->isWorkday() ? $schedule->shift?->id : null,
                'scheduled_start' => $schedule->scheduledStart,
                'scheduled_end' => $schedule->scheduledEnd,
            ]);
        }

        if (! $day->exists) {
            // Placeholder until recompute() below (same transaction).
            $day->status = AttendanceStatus::NeedsCorrection;
        }

        $day->save();
        $logs = [];

        if ($checkInTime !== null) {
            $logs[] = $log = $this->log($actor, $employee, $day, AttendanceLogType::CheckIn, $checkIn, $reason);
            $day->check_in_at = $checkIn->utc();
            $day->check_in_log_id = $log->id;
        }

        if ($checkOutTime !== null && $checkOut !== null) {
            $logs[] = $log = $this->log($actor, $employee, $day, AttendanceLogType::CheckOut, $checkOut, $reason);
            $day->check_out_at = $checkOut->utc();
            $day->check_out_log_id = $log->id;
        }

        $this->recompute($day, $schedule, $remote, $now);
        $day->clearManualStatus();
        $day->save();

        return $logs;
    }

    /**
     * Same rules as CheckIn/CheckOut: late from the tolerance limit, early
     * leave before end − tolerance; a past day without check-out still needs
     * correction.
     */
    public function recompute(AttendanceDay $day, DaySchedule $schedule, bool $remote, CarbonImmutable $now): void
    {
        $checkIn = $day->check_in_at;

        if ($checkIn === null) {
            return;
        }

        // Half-day leave/permit or business trip (same as CheckIn/CheckOut): the
        // request explains the hours, so never late/early, and a request status
        // (Cuti/Izin/Dinas) stays. A status HR set by hand is not a request.
        $fromRequest = $day->isFromRequest();
        $requestStatus = $day->status->comesFromRequest() && ! $day->isManual() ? $day->status : null;
        $day->late_minutes = $fromRequest ? 0 : CheckIn::lateMinutes($schedule, $checkIn);
        $status = $day->late_minutes > 0 ? AttendanceStatus::Late : ($remote ? AttendanceStatus::Wfh : AttendanceStatus::Present);
        $day->early_leave_minutes = 0;
        $day->work_minutes = 0;

        if ($day->check_out_at !== null) {
            $day->early_leave_minutes = $fromRequest ? 0 : CheckOut::earlyLeaveMinutes($day, $day->check_out_at);
            $day->work_minutes = CheckOut::workMinutes($day, $day->check_out_at);

            if ($day->early_leave_minutes > 0 && in_array($status, [AttendanceStatus::Present, AttendanceStatus::Wfh], true)) {
                $status = AttendanceStatus::EarlyLeave;
            }
        } elseif ($day->work_date->lt(ScheduleResolver::officeDate($now))) {
            $status = AttendanceStatus::NeedsCorrection;
        }

        $day->status = $requestStatus ?? $status;
    }

    /**
     * Audit snapshot of a day (old / new values).
     *
     * @return array<string, mixed>
     */
    public static function snapshot(AttendanceDay $day): array
    {
        return [
            'work_date' => $day->work_date->toDateString(),
            'status' => $day->exists ? $day->status->value : null,
            'check_in_at' => $day->check_in_at?->toIso8601String(),
            'check_out_at' => $day->check_out_at?->toIso8601String(),
            'late_minutes' => $day->late_minutes,
            'early_leave_minutes' => $day->early_leave_minutes,
            'work_minutes' => $day->work_minutes,
        ];
    }

    private function log(User $actor, User $employee, AttendanceDay $day, AttendanceLogType $type, CarbonImmutable $at, string $reason): AttendanceLog
    {
        return AttendanceLog::query()->create([
            'user_id' => $employee->id,
            'attendance_day_id' => $day->id,
            'type' => $type,
            'method' => AttendanceMethod::Manual,
            'occurred_at' => $at->utc(),
            'corrected_by' => $actor->id,
            'flags' => [],
            'is_suspicious' => false,
            'note' => $reason,
        ]);
    }

    /**
     * An office time of the work date. For a shift crossing midnight, a time
     * before its check-in window opens (start − window) belongs to the morning
     * after the work date (e.g. 22.00–06.00: 00.20 and 06.00 are the next day).
     */
    private static function at(CarbonImmutable $workDate, string $time, DaySchedule $schedule): CarbonImmutable
    {
        $at = CarbonImmutable::parse($workDate->toDateString().' '.$time, OfficeClock::timezone());
        $opensAt = $schedule->shift?->crosses_midnight === true ? $schedule->checkInOpensAt() : null;

        return $opensAt !== null && $at->lt($opensAt) ? $at->addDay() : $at;
    }
}
