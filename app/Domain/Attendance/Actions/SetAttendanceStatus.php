<?php

namespace App\Domain\Attendance\Actions;

use App\Domain\Attendance\Enums\AttendanceStatus;
use App\Domain\Attendance\Events\AttendanceRecorded;
use App\Domain\Attendance\Models\AttendanceDay;
use App\Domain\Attendance\Models\AttendanceLog;
use App\Domain\Attendance\Services\ManualAttendanceWriter;
use App\Domain\Attendance\Services\ScheduleResolver;
use App\Domain\Organization\Services\AuditLogger;
use App\Domain\Payroll\Services\PayrollLock;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Absensi › Pegawai (keputusan pemilik 20 Okt 2026): HR sets the status of
 * one employee's date by hand, optionally with check-in/out times for the
 * statuses where the employee worked. The row is marked
 * `status_source = manual`, so closing the day never overwrites it; a real
 * check-in/out or an approved request clears the mark again.
 *
 * - Present / Late / WFH / Dinas with times: manual logs (ManualAttendanceWriter),
 *   recomputed minutes, then the chosen status wins. Late keeps the computed
 *   late minutes; the other statuses count no late / early-leave minutes.
 * - Every other status (or no times): the status only. Existing logs and
 *   check-in fields stay (logs are immutable); late / early minutes are zeroed.
 * - Full-day request days are changed through the request; a locked payroll
 *   month is refused; future dates only for Izin / Sakit / Cuti / Dinas / Libur.
 *
 * Audited as `attendance.status_set`.
 */
final class SetAttendanceStatus
{
    /** Statuses HR may set by hand. */
    public const array ALLOWED = [
        AttendanceStatus::Present,
        AttendanceStatus::Late,
        AttendanceStatus::Wfh,
        AttendanceStatus::BusinessTrip,
        AttendanceStatus::Permit,
        AttendanceStatus::Sick,
        AttendanceStatus::Leave,
        AttendanceStatus::Absent,
        AttendanceStatus::Holiday,
    ];

    /** Statuses that may be set ahead of time. */
    public const array FUTURE_ALLOWED = [
        AttendanceStatus::Permit,
        AttendanceStatus::Sick,
        AttendanceStatus::Leave,
        AttendanceStatus::BusinessTrip,
        AttendanceStatus::Holiday,
    ];

    /** Statuses where check-in/out times are written. */
    public const array WITH_TIMES = [
        AttendanceStatus::Present,
        AttendanceStatus::Late,
        AttendanceStatus::Wfh,
        AttendanceStatus::BusinessTrip,
    ];

    public function __construct(
        private readonly ScheduleResolver $schedules,
        private readonly AuditLogger $audit,
        private readonly ManualAttendanceWriter $writer,
        private readonly PayrollLock $lock,
    ) {}

    /**
     * @param  string  $date  office date "Y-m-d"
     * @param  string|null  $checkIn  office time "H:i" (only for WITH_TIMES)
     * @param  string|null  $checkOut  office time "H:i" (only for WITH_TIMES)
     *
     * @throws ValidationException
     */
    public function handle(
        User $actor,
        User $employee,
        string $date,
        AttendanceStatus $status,
        ?string $checkIn,
        ?string $checkOut,
        string $reason,
    ): AttendanceDay {
        if (! in_array($status, self::ALLOWED, true)) {
            throw ValidationException::withMessages(['status' => 'Status ini tidak bisa diatur manual.']);
        }

        $workDate = ScheduleResolver::parseDate($date);
        $now = CarbonImmutable::now();

        if ($workDate->gt(ScheduleResolver::officeDate($now)) && ! in_array($status, self::FUTURE_ALLOWED, true)) {
            throw ValidationException::withMessages(['work_date' => 'Tanggal belum terjadi.']);
        }

        $this->lock->assertOpen($employee->company_id, $workDate);

        $withTimes = in_array($status, self::WITH_TIMES, true) && ($checkIn !== null || $checkOut !== null);
        $schedule = $this->schedules->forDate($employee, $workDate);

        [$day, $old, $logs] = DB::transaction(function () use ($actor, $employee, $workDate, $schedule, $status, $checkIn, $checkOut, $reason, $withTimes, $now): array {
            $day = AttendanceDay::query()
                ->where('user_id', $employee->id)
                ->whereDate('work_date', $workDate->toDateString())
                ->lockForUpdate()
                ->first() ?? new AttendanceDay(['user_id' => $employee->id, 'work_date' => $workDate->toDateString()]);

            ManualAttendanceWriter::assertNotRequestDay($day);

            $old = self::snapshot($day);
            $logs = [];

            if ($withTimes) {
                $logs = $this->writer->apply($actor, $employee, $day, $schedule, $checkIn, $checkOut, $reason, $now);
            } elseif (! $day->exists || $day->scheduled_start === null) {
                $day->fill([
                    'shift_id' => $schedule->isWorkday() ? $schedule->shift?->id : null,
                    'scheduled_start' => $schedule->scheduledStart,
                    'scheduled_end' => $schedule->scheduledEnd,
                ]);
            }

            // The chosen status wins over the computed one. Only "Terlambat" keeps
            // late minutes; early leave counts nowhere on a status set by hand.
            if ($status !== AttendanceStatus::Late) {
                $day->late_minutes = 0;
            }

            $day->early_leave_minutes = 0;
            $day->fill([
                'status' => $status,
                'status_source' => AttendanceDay::SOURCE_MANUAL,
                'status_set_by' => $actor->id,
                'status_set_at' => $now,
            ])->save();

            return [$day, $old, $logs];
        });

        $this->audit->log('attendance.status_set', $day, $old, [
            ...self::snapshot($day),
            'reason' => $reason,
            'employee_id' => $employee->id,
        ], $actor);

        $last = end($logs);

        if ($last instanceof AttendanceLog) {
            AttendanceRecorded::dispatch($day, $last);
        }

        return $day;
    }

    /**
     * @return array<string, mixed>
     */
    private static function snapshot(AttendanceDay $day): array
    {
        return [
            ...ManualAttendanceWriter::snapshot($day),
            'status_source' => $day->status_source,
        ];
    }
}
