<?php

namespace App\Domain\Attendance\Actions;

use App\Domain\Attendance\Models\AttendanceDay;
use App\Domain\Attendance\Services\ManualAttendanceWriter;
use App\Domain\Attendance\Services\ScheduleResolver;
use App\Domain\Organization\Services\AuditLogger;
use App\Domain\Payroll\Services\PayrollLock;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Absensi › Pegawai: HR removes one employee's attendance row of a date, e.g.
 * an "Alpha" or a status set by mistake. Only rows without check-in logs
 * (logs are immutable and keep their day), not linked to a request, and not
 * in a locked payroll month. Audited as `attendance.day_cleared`.
 */
final class ClearAttendanceDay
{
    public function __construct(
        private readonly AuditLogger $audit,
        private readonly PayrollLock $lock,
    ) {}

    /**
     * @param  string  $date  office date "Y-m-d"
     *
     * @throws ValidationException
     */
    public function handle(User $actor, User $employee, string $date, string $reason): void
    {
        $workDate = ScheduleResolver::parseDate($date);

        $this->lock->assertOpen($employee->company_id, $workDate);

        [$day, $old] = DB::transaction(function () use ($employee, $workDate): array {
            $day = AttendanceDay::query()
                ->where('user_id', $employee->id)
                ->whereDate('work_date', $workDate->toDateString())
                ->lockForUpdate()
                ->first();

            if ($day === null) {
                throw ValidationException::withMessages(['work_date' => 'Tidak ada catatan absensi pada tanggal ini.']);
            }

            if ($day->logs()->exists()) {
                throw ValidationException::withMessages(['work_date' => 'Hari ini punya catatan check-in, jadi tidak bisa dihapus. Ubah statusnya saja.']);
            }

            if ($day->isFromRequest()) {
                throw ValidationException::withMessages([
                    'work_date' => "Tanggal ini tercatat {$day->status->label()} dari pengajuan yang disetujui. Ubah lewat pengajuan.",
                ]);
            }

            $old = [...ManualAttendanceWriter::snapshot($day), 'status_source' => $day->status_source];
            $day->delete();

            return [$day, $old];
        });

        $this->audit->log('attendance.day_cleared', $day, $old, [
            'work_date' => $workDate->toDateString(),
            'reason' => $reason,
            'employee_id' => $employee->id,
        ], $actor);
    }
}
