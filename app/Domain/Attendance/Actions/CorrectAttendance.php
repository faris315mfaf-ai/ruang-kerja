<?php

namespace App\Domain\Attendance\Actions;

use App\Domain\Attendance\Data\CorrectionData;
use App\Domain\Attendance\Data\DaySchedule;
use App\Domain\Attendance\Enums\AttendanceLogType;
use App\Domain\Attendance\Enums\AttendanceMethod;
use App\Domain\Attendance\Enums\AttendanceStatus;
use App\Domain\Attendance\Events\AttendanceRecorded;
use App\Domain\Attendance\Models\AttendanceDay;
use App\Domain\Attendance\Models\AttendanceLog;
use App\Domain\Attendance\Services\ScheduleResolver;
use App\Domain\Attendance\Support\OfficeClock;
use App\Domain\Organization\Services\AuditLogger;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Manual correction by HR (docs/PRD.md M2 "Manual oleh HR"): new immutable
 * logs with method `manual`, `corrected_by` and the reason as note; the day is
 * recomputed with the same rules as a live check-in/out; old and new values
 * go to audit_logs (`attendance.corrected`).
 */
final class CorrectAttendance
{
    public function __construct(
        private readonly ScheduleResolver $schedules,
        private readonly AuditLogger $audit,
    ) {}

    /**
     * @throws ValidationException
     */
    public function handle(User $actor, User $employee, CorrectionData $data): AttendanceDay
    {
        $workDate = ScheduleResolver::parseDate($data->workDate);
        $now = CarbonImmutable::now();

        if ($workDate->gt(ScheduleResolver::officeDate($now))) {
            throw ValidationException::withMessages(['work_date' => 'Tanggal koreksi tidak boleh di masa depan.']);
        }

        if ($data->checkIn === null && $data->checkOut === null) {
            throw ValidationException::withMessages(['check_in' => 'Isi jam masuk, jam pulang, atau keduanya.']);
        }

        $schedule = $this->schedules->forDate($employee, $workDate);

        [$day, $old, $logs] = DB::transaction(function () use ($actor, $employee, $data, $workDate, $schedule, $now): array {
            $day = AttendanceDay::query()
                ->where('user_id', $employee->id)
                ->whereDate('work_date', $workDate->toDateString())
                ->lockForUpdate()
                ->first() ?? new AttendanceDay(['user_id' => $employee->id, 'work_date' => $workDate->toDateString()]);

            // Full-day leave/permit/sick belongs to the request. Half days and
            // business trips expect work, so a forgotten check-in/out is corrected
            // here while the request status and request_id stay.
            if ($day->exists && $day->status->comesFromRequest() && ! $day->allowsCheckInDespiteRequest()) {
                throw ValidationException::withMessages([
                    'work_date' => "Tanggal ini tercatat {$day->status->label()} dari pengajuan yang disetujui. Ubah lewat pengajuan.",
                ]);
            }

            $old = self::snapshot($day);
            $checkIn = $data->checkIn === null ? $day->check_in_at : self::at($workDate, $data->checkIn, $schedule);
            $checkOut = $data->checkOut === null ? $day->check_out_at : self::at($workDate, $data->checkOut, $schedule);

            if ($checkIn === null) {
                throw ValidationException::withMessages(['check_in' => 'Isi jam masuk: tanggal ini belum punya check-in.']);
            }

            // A new check-out at or before the check-in belongs to the next day (overnight shift).
            if ($data->checkOut !== null && $checkOut !== null && $checkOut->lte($checkIn)) {
                $checkOut = $checkOut->addDay();
            }

            if ($checkOut !== null && $checkOut->lte($checkIn)) {
                throw ValidationException::withMessages(['check_out' => 'Jam pulang harus setelah jam masuk.']);
            }

            foreach (['check_in' => $data->checkIn === null ? null : $checkIn, 'check_out' => $data->checkOut === null ? null : $checkOut] as $field => $instant) {
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

            if ($data->checkIn !== null) {
                $logs[] = $log = $this->log($actor, $employee, $day, AttendanceLogType::CheckIn, $checkIn, $data->reason);
                $day->check_in_at = $checkIn->utc();
                $day->check_in_log_id = $log->id;
            }

            if ($data->checkOut !== null && $checkOut !== null) {
                $logs[] = $log = $this->log($actor, $employee, $day, AttendanceLogType::CheckOut, $checkOut, $data->reason);
                $day->check_out_at = $checkOut->utc();
                $day->check_out_log_id = $log->id;
            }

            $this->recompute($day, $schedule, $remote, $now);
            $day->save();

            return [$day, $old, $logs];
        });

        $this->audit->log('attendance.corrected', $day, $old, [
            ...self::snapshot($day),
            'reason' => $data->reason,
            'employee_id' => $employee->id,
        ], $actor);

        $last = end($logs);

        if ($last instanceof AttendanceLog) {
            AttendanceRecorded::dispatch($day, $last);
        }

        return $day;
    }

    /**
     * Same rules as CheckIn/CheckOut: late from the tolerance limit, early
     * leave before end − tolerance; a past day without check-out still needs
     * correction.
     */
    private function recompute(AttendanceDay $day, DaySchedule $schedule, bool $remote, CarbonImmutable $now): void
    {
        $checkIn = $day->check_in_at;

        if ($checkIn === null) {
            return;
        }

        // Half-day leave/permit or business trip (same as CheckIn/CheckOut): the
        // request explains the hours, so never late/early, and a request status
        // (Cuti/Izin/Dinas) stays.
        $fromRequest = $day->isFromRequest();
        $requestStatus = $day->status->comesFromRequest() ? $day->status : null;
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

    /**
     * @return array<string, mixed>
     */
    private static function snapshot(AttendanceDay $day): array
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
}
