<?php

namespace App\Domain\Attendance\Actions;

use App\Domain\Attendance\Data\CorrectionData;
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
 * Manual correction by HR (docs/PRD.md M2 "Manual oleh HR"): new immutable
 * logs with method `manual`, `corrected_by` and the reason as note; the day is
 * recomputed with the same rules as a live check-in/out (ManualAttendanceWriter);
 * old and new values go to audit_logs (`attendance.corrected`). A locked
 * payroll month is refused (PayrollLock).
 */
final class CorrectAttendance
{
    public function __construct(
        private readonly ScheduleResolver $schedules,
        private readonly AuditLogger $audit,
        private readonly ManualAttendanceWriter $writer,
        private readonly PayrollLock $lock,
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

        $this->lock->assertOpen($employee->company_id, $workDate);
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
            ManualAttendanceWriter::assertNotRequestDay($day);

            $old = ManualAttendanceWriter::snapshot($day);
            $logs = $this->writer->apply($actor, $employee, $day, $schedule, $data->checkIn, $data->checkOut, $data->reason, $now);

            return [$day, $old, $logs];
        });

        $this->audit->log('attendance.corrected', $day, $old, [
            ...ManualAttendanceWriter::snapshot($day),
            'reason' => $data->reason,
            'employee_id' => $employee->id,
        ], $actor);

        $last = end($logs);

        if ($last instanceof AttendanceLog) {
            AttendanceRecorded::dispatch($day, $last);
        }

        return $day;
    }
}
