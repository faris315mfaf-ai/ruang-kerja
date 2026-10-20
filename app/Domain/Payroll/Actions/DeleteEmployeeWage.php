<?php

namespace App\Domain\Payroll\Actions;

use App\Domain\Organization\Services\AuditLogger;
use App\Domain\Payroll\Models\EmployeeWage;
use App\Domain\Payroll\Services\PayrollLock;
use App\Models\User;
use Illuminate\Validation\ValidationException;

/**
 * Removes one wage row (e.g. entered with the wrong date), unless its month
 * is locked. Audited as `payroll.wage_deleted`.
 */
final class DeleteEmployeeWage
{
    public function __construct(
        private readonly AuditLogger $audit,
        private readonly PayrollLock $lock,
    ) {}

    /**
     * @throws ValidationException
     */
    public function handle(User $actor, EmployeeWage $wage): void
    {
        $this->lock->assertOpen($wage->company_id, $wage->effective_from, 'effective_from');

        $old = [
            'employee_id' => $wage->user_id,
            'effective_from' => $wage->effective_from->toDateString(),
            'daily_wage' => $wage->daily_wage,
            'note' => $wage->note,
        ];

        $wage->delete();

        $this->audit->log('payroll.wage_deleted', $wage, $old, null, $actor);
    }
}
