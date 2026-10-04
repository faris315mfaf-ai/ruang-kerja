<?php

namespace App\Policies;

use App\Domain\Organization\Enums\Permission;
use App\Models\LeaveType;
use App\Models\User;

/**
 * Every employee sees the company's leave types (request form); HR & Super Admin manage them.
 */
class LeaveTypePolicy
{
    public function viewAny(User $actor): bool
    {
        return true;
    }

    public function view(User $actor, LeaveType $type): bool
    {
        return $actor->company_id === $type->company_id;
    }

    public function manage(User $actor): bool
    {
        return $actor->hasPermission(Permission::RequestsManageFlows);
    }

    public function create(User $actor): bool
    {
        return $this->manage($actor);
    }

    public function update(User $actor, LeaveType $type): bool
    {
        return $this->view($actor, $type) && $this->manage($actor);
    }

    public function delete(User $actor, LeaveType $type): bool
    {
        return $this->update($actor, $type);
    }

    public function restore(User $actor, LeaveType $type): bool
    {
        return $this->update($actor, $type);
    }

    public function forceDelete(User $actor, LeaveType $type): bool
    {
        return false;
    }
}
