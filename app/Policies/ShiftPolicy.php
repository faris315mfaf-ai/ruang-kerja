<?php

namespace App\Policies;

use App\Domain\Attendance\Models\Shift;
use App\Domain\Organization\Enums\Permission;
use App\Models\User;

class ShiftPolicy
{
    public function viewAny(User $actor): bool
    {
        return true;
    }

    public function view(User $actor, Shift $shift): bool
    {
        return $actor->company_id === $shift->company_id;
    }

    public function create(User $actor): bool
    {
        return $actor->hasPermission(Permission::AttendanceManage);
    }

    public function update(User $actor, Shift $shift): bool
    {
        return $this->view($actor, $shift) && $this->create($actor);
    }

    /**
     * Soft delete; the Action refuses shifts that still have active assignments.
     */
    public function delete(User $actor, Shift $shift): bool
    {
        return $this->update($actor, $shift);
    }
}
