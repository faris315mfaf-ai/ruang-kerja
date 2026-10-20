<?php

namespace App\Domain\Payroll\Actions;

use App\Domain\Attendance\Services\ScheduleResolver;
use App\Domain\Organization\Services\AuditLogger;
use App\Domain\Payroll\Models\EmployeeWage;
use App\Domain\Payroll\Services\PayrollLock;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Sets the daily wage of an employee from an office date on (one row per
 * effective date: saving the same date again replaces it). A date in a
 * locked payroll month is refused. Audited as `payroll.wage_saved`.
 */
final class SaveEmployeeWage
{
    public function __construct(
        private readonly AuditLogger $audit,
        private readonly PayrollLock $lock,
    ) {}

    /**
     * @throws ValidationException
     */
    public function handle(User $actor, User $employee, int $dailyWage, string $effectiveFrom, ?string $note = null): EmployeeWage
    {
        if ($dailyWage < 0) {
            throw ValidationException::withMessages(['daily_wage' => 'Upah harian tidak boleh minus.']);
        }

        $from = ScheduleResolver::parseDate($effectiveFrom);
        $this->lock->assertOpen($employee->company_id, $from, 'effective_from');
        $note = $note === null || trim($note) === '' ? null : trim($note);

        [$wage, $old] = DB::transaction(function () use ($actor, $employee, $dailyWage, $from, $note): array {
            $wage = EmployeeWage::query()
                ->where('user_id', $employee->id)
                ->whereDate('effective_from', $from->toDateString())
                ->lockForUpdate()
                ->first();
            $old = $wage === null ? null : ['daily_wage' => $wage->daily_wage, 'note' => $wage->note];

            $wage ??= new EmployeeWage([
                'company_id' => $employee->company_id,
                'user_id' => $employee->id,
                'effective_from' => $from->toDateString(),
            ]);
            $wage->fill(['daily_wage' => $dailyWage, 'note' => $note, 'created_by' => $actor->id])->save();

            return [$wage, $old];
        });

        $this->audit->log('payroll.wage_saved', $wage, $old, [
            'employee_id' => $employee->id,
            'effective_from' => $from->toDateString(),
            'daily_wage' => $dailyWage,
            'note' => $note,
        ], $actor);

        return $wage;
    }
}
