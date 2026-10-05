<?php

namespace App\Policies;

use App\Domain\Attendance\Models\ShiftAssignment;
use App\Domain\Organization\Enums\Permission;
use App\Models\User;

/**
 * Schedules are maintained by HR & Super Admin for employees of their company.
 */
class ShiftAssignmentPolicy
{
    public function viewAny(User $actor): bool
    {
        return $actor->hasPermission(Permission::AttendanceManage);
    }

    /**
     * Assign shifts to this employee.
     */
    public function create(User $actor, ?User $employee = null): bool
    {
        return $actor->hasPermission(Permission::AttendanceManage)
            && ($employee === null || $employee->company_id === $actor->company_id);
    }

    public function delete(User $actor, ShiftAssignment $assignment): bool
    {
        return $actor->hasPermission(Permission::AttendanceManage)
            && $assignment->user->company_id === $actor->company_id;
    }
}
