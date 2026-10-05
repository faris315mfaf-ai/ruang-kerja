<?php

namespace App\Policies;

use App\Domain\Attendance\Models\AttendanceLog;
use App\Domain\Organization\Enums\Permission;
use App\Models\User;

/**
 * Logs are immutable. Selfies: the employee, HR (attendance.view_selfie) and
 * the direct manager only (docs/PRD.md §8) — not Super Admin, not other Kadiv.
 */
class AttendanceLogPolicy
{
    public function viewSelfie(User $actor, AttendanceLog $log): bool
    {
        if ($log->user_id === $actor->id) {
            return true;
        }

        $owner = $log->user;

        if ($owner->company_id !== $actor->company_id) {
            return false;
        }

        return $actor->hasPermission(Permission::AttendanceViewSelfie) || $owner->manager_id === $actor->id;
    }

    /**
     * "Tandai sudah ditinjau" on a flagged log: HR & Super Admin
     * (attendance.manage) of the same company, never for their own log.
     */
    public function review(User $actor, AttendanceLog $log): bool
    {
        return $actor->hasPermission(Permission::AttendanceManage)
            && $log->user_id !== $actor->id
            && $log->user->company_id === $actor->company_id;
    }

    public function update(User $actor, AttendanceLog $log): bool
    {
        return false;
    }

    public function delete(User $actor, AttendanceLog $log): bool
    {
        return false;
    }
}
