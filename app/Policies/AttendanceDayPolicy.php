<?php

namespace App\Policies;

use App\Domain\Attendance\Models\AttendanceDay;
use App\Domain\Organization\Enums\Permission;
use App\Models\Division;
use App\Models\User;

/**
 * Attendance scope (docs/ARCHITECTURE.md §4): self, direct reports, the
 * divisions a Kepala Divisi leads, everyone with attendance.view_all.
 */
class AttendanceDayPolicy
{
    /**
     * Own attendance page (lists go through AttendanceDay::visibleTo()).
     */
    public function viewAny(User $actor): bool
    {
        return true;
    }

    public function view(User $actor, AttendanceDay $day): bool
    {
        return AttendanceDay::visibleUserIds($actor)->whereKey($day->user_id)->exists();
    }

    /**
     * Check in/out for oneself (inactive employees are logged out by middleware).
     */
    public function checkIn(User $actor): bool
    {
        return $actor->isActive();
    }

    /**
     * Private channel `company.attendance` (live board of HR, Direksi, Super Admin).
     */
    public function viewCompanyFeed(User $actor): bool
    {
        return $actor->hasPermission(Permission::AttendanceViewAll);
    }

    /**
     * Private channel `division.{id}.attendance` (Kepala Divisi of that division).
     */
    public function viewDivisionFeed(User $actor, Division $division): bool
    {
        if ($actor->company_id !== $division->company_id) {
            return false;
        }

        return $actor->hasPermission(Permission::AttendanceViewAll)
            || in_array($division->id, $actor->ledDivisionIds(), true);
    }
}
