<?php

namespace App\Policies;

use App\Domain\Organization\Enums\Permission;
use App\Domain\Payroll\Models\EmployeeWage;
use App\Models\User;

/**
 * Gaji harian (keputusan pemilik 20 Okt 2026, docs/fitur/absensi-gaji.md):
 * payroll.view reads the page (HR, Super Admin, Direksi read-only);
 * payroll.manage changes wages, rules and period locks (HR, Super Admin).
 * Always within the actor's own company.
 */
class PayrollPolicy
{
    /**
     * Absensi › Gaji and its export.
     */
    public function viewAny(User $actor): bool
    {
        return $actor->isActive() && $actor->hasPermission(Permission::PayrollView);
    }

    /**
     * Pay rules and period lock / unlock of the actor's company.
     */
    public function manage(User $actor): bool
    {
        return $actor->isActive() && $actor->hasPermission(Permission::PayrollManage);
    }

    /**
     * Read the wage history of one employee (wage dialog).
     */
    public function viewWages(User $actor, User $employee): bool
    {
        return $this->viewAny($actor) && $actor->company_id === $employee->company_id;
    }

    /**
     * Set a daily wage of one employee of the same company.
     */
    public function manageWages(User $actor, User $employee): bool
    {
        return $this->manage($actor) && $actor->company_id === $employee->company_id;
    }

    /**
     * Delete one wage row of the same company.
     */
    public function delete(User $actor, EmployeeWage $wage): bool
    {
        return $this->manage($actor) && $actor->company_id === $wage->company_id;
    }
}
