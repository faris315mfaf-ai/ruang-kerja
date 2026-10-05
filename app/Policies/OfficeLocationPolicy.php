<?php

namespace App\Policies;

use App\Domain\Attendance\Models\OfficeLocation;
use App\Domain\Organization\Enums\Permission;
use App\Models\User;

/**
 * Every employee sees the company's locations (check-in map); HR & Super
 * Admin (attendance.manage) maintain them.
 */
class OfficeLocationPolicy
{
    public function viewAny(User $actor): bool
    {
        return true;
    }

    public function view(User $actor, OfficeLocation $location): bool
    {
        return $actor->company_id === $location->company_id;
    }

    /**
     * Admin › Lokasi, shift & hari libur.
     */
    public function manage(User $actor): bool
    {
        return $actor->hasPermission(Permission::AttendanceManage);
    }

    public function create(User $actor): bool
    {
        return $this->manage($actor);
    }

    public function update(User $actor, OfficeLocation $location): bool
    {
        return $this->view($actor, $location) && $this->manage($actor);
    }

    public function delete(User $actor, OfficeLocation $location): bool
    {
        return $this->update($actor, $location);
    }
}
