<?php

namespace App\Http\Resources\Attendance;

use App\Domain\Attendance\Models\AttendanceDay;
use App\Domain\Attendance\Models\AttendanceLog;
use App\Domain\Attendance\Services\ScheduleResolver;
use App\Domain\Attendance\Support\OfficeClock;
use App\Domain\Organization\Enums\Permission;
use App\Domain\Payroll\Models\EmployeeWage;
use App\Domain\Payroll\Models\PayrollRule;
use App\Domain\Payroll\Queries\PayrollCalculator;
use App\Domain\Payroll\Services\PayrollLock;
use App\Models\AuditLog;
use App\Models\User;
use Carbon\CarbonImmutable;

/**
 * Absensi › Pegawai › side sheet of one employee's date: status, times,
 * manual mark, history (audit + logs) and the effect on gaji harian.
 */
final class EmployeeDayPresenter
{
    /** Audit actions that change one attendance date. */
    private const array HISTORY = [
        'attendance.corrected' => 'Jam dikoreksi HR',
        'attendance.status_set' => 'Status diatur HR',
        'attendance.day_cleared' => 'Catatan dihapus HR',
        'attendance_day.corrected' => 'Dikoreksi lewat pengajuan',
        'attendance_day.correction_reverted' => 'Koreksi pengajuan dibatalkan',
    ];

    public function __construct(
        private readonly ScheduleResolver $schedules,
        private readonly PayrollLock $lock,
    ) {}

    /**
     * @return array<string, mixed>
     */
    public function detail(User $viewer, User $employee, CarbonImmutable $date): array
    {
        $key = $date->toDateString();
        $day = AttendanceDay::query()
            ->with(['statusSetter:id,name', 'employeeRequest:id,number,leave_type_id', 'employeeRequest.leaveType:id,name,category'])
            ->where('user_id', $employee->id)
            ->whereDate('work_date', $key)
            ->first();
        $logs = $day === null ? collect() : AttendanceLog::query()
            ->with('correctedBy:id,name')
            ->where('attendance_day_id', $day->id)
            ->orderBy('occurred_at')
            ->get();
        $schedule = $this->schedules->forDate($employee, $date);
        $today = ScheduleResolver::officeDate(CarbonImmutable::now())->toDateString();
        $kind = match (true) {
            $day !== null => $day->status->value,
            $schedule->isHoliday() => 'holiday',
            ! $schedule->isWorkday() => 'off',
            default => 'none',
        };
        $pay = PayrollCalculator::classify($day, $kind, $key <= $today, PayrollRule::forCompany($employee->company_id)->toRules());
        $seesPay = $viewer->hasPermission(Permission::PayrollView);
        $hasLogs = $logs->isNotEmpty();
        $locked = $this->lock->isLocked($employee->company_id, $date);
        $canEdit = $viewer->can('setStatus', [AttendanceDay::class, $employee]) && ! $locked;

        return [
            'employee' => ['id' => $employee->id, 'name' => $employee->name],
            'date' => $key,
            'scheduled' => $schedule->isWorkday(),
            'shift' => $schedule->shift === null ? null : $schedule->shift->name.' '.$schedule->shift->hoursLabel(),
            'holiday' => $schedule->holiday?->name,
            'exists' => $day !== null,
            'status' => $day?->status->value,
            'status_label' => $day?->status->label(),
            'check_in' => $day?->check_in_at === null ? null : OfficeClock::local($day->check_in_at)->format('H.i'),
            'check_out' => $day?->check_out_at === null ? null : OfficeClock::local($day->check_out_at)->format('H.i'),
            'late_minutes' => $day === null ? 0 : $day->late_minutes,
            'manual' => $day?->isManual() ?? false,
            'set_by' => $day?->statusSetter?->name,
            'set_at' => $day?->status_set_at?->toIso8601ZuluString(),
            'from_request' => $day?->isFromRequest() ?? false,
            'request' => $day?->employeeRequest === null ? null : [
                'number' => $day->employeeRequest->number,
                'type' => $day->employeeRequest->leaveType->name,
            ],
            'has_logs' => $hasLogs,
            'locked' => $locked,
            'can' => [
                'set_status' => $canEdit && ($day === null || ! $day->blocksCheckIn()),
                'clear' => $canEdit && $day !== null && ! $hasLogs && ! $day->isFromRequest(),
            ],
            'logs' => array_values($logs->map(fn (AttendanceLog $log): array => [
                'id' => $log->id,
                'type' => $log->type->value,
                'method' => $log->method->value,
                'method_label' => $log->method->label(),
                'at' => OfficeClock::local($log->occurred_at)->format('H.i'),
                'occurred_at' => $log->occurred_at->toIso8601ZuluString(),
                'note' => $log->note,
                'corrected_by' => $log->correctedBy?->name,
            ])->all()),
            'history' => $this->history($viewer, $employee, $key, $day),
            'wage_effect' => [
                'paid' => $pay->paid() > 0,
                'paid_days' => $pay->paid(),
                'pending' => $pay->pending > 0,
                'label' => $pay->label,
                'daily_wage' => $seesPay ? PayrollCalculator::wageOn($this->wages($employee, $key), $key) : null,
            ],
        ];
    }

    /**
     * Latest audit entries of this date (company of the viewer), newest first.
     *
     * @return list<array<string, mixed>>
     */
    private function history(User $viewer, User $employee, string $date, ?AttendanceDay $day): array
    {
        return array_values(AuditLog::query()
            ->with('user:id,name')
            ->where('company_id', $viewer->company_id)
            ->where('auditable_type', (new AttendanceDay)->getMorphClass())
            ->whereIn('action', array_keys(self::HISTORY))
            ->where(function ($query) use ($employee, $day): void {
                $query->where('new_values->employee_id', $employee->id);

                if ($day !== null) {
                    $query->orWhere('auditable_id', $day->id);
                }
            })
            ->where(fn ($query) => $query->where('new_values->work_date', $date)->orWhere('old_values->work_date', $date))
            ->latest('created_at')
            ->limit(20)
            ->get()
            ->map(fn (AuditLog $entry): array => [
                'action' => $entry->action,
                'label' => self::HISTORY[$entry->action] ?? $entry->action,
                'actor' => $entry->user?->name,
                'at' => $entry->created_at->toIso8601ZuluString(),
                'reason' => is_string($entry->new_values['reason'] ?? null) ? $entry->new_values['reason'] : null,
                'from_status' => is_string($entry->old_values['status'] ?? null) ? $entry->old_values['status'] : null,
                'to_status' => is_string($entry->new_values['status'] ?? null) ? $entry->new_values['status'] : null,
            ])->all());
    }

    /**
     * @return list<array{0: string, 1: int}>
     */
    private function wages(User $employee, string $date): array
    {
        return array_values(EmployeeWage::query()
            ->where('user_id', $employee->id)
            ->whereDate('effective_from', '<=', $date)
            ->orderBy('effective_from')
            ->get(['effective_from', 'daily_wage'])
            ->map(fn (EmployeeWage $wage): array => [$wage->effective_from->toDateString(), $wage->daily_wage])
            ->all());
    }
}
