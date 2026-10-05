<?php

namespace App\Policies;

use App\Domain\Attendance\Models\Holiday;
use App\Domain\Organization\Enums\Permission;
use App\Models\User;

class HolidayPolicy
{
    public function viewAny(User $actor): bool
    {
        return true;
    }

    public function view(User $actor, Holiday $holiday): bool
    {
        return $actor->company_id === $holiday->company_id;
    }

    /**
     * Create one holiday or import a CSV.
     */
    public function create(User $actor): bool
    {
        return $actor->hasPermission(Permission::AttendanceManage);
    }

    public function update(User $actor, Holiday $holiday): bool
    {
        return $this->view($actor, $holiday) && $this->create($actor);
    }

    public function delete(User $actor, Holiday $holiday): bool
    {
        return $this->update($actor, $holiday);
    }
}
