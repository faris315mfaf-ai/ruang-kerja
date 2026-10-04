<?php

namespace App\Policies;

use App\Domain\Organization\Enums\Permission;
use App\Models\Position;
use App\Models\User;

/**
 * Everyone in the company may see positions; HR & Super Admin manage them.
 */
class PositionPolicy
{
    public function viewAny(User $actor): bool
    {
        return true;
    }

    public function view(User $actor, Position $position): bool
    {
        return $actor->company_id === $position->company_id;
    }

    public function create(User $actor): bool
    {
        return $actor->hasPermission(Permission::OrganizationManage);
    }

    public function update(User $actor, Position $position): bool
    {
        return $this->view($actor, $position) && $actor->hasPermission(Permission::OrganizationManage);
    }

    public function delete(User $actor, Position $position): bool
    {
        return $this->update($actor, $position);
    }

    public function restore(User $actor, Position $position): bool
    {
        return $this->update($actor, $position);
    }

    public function forceDelete(User $actor, Position $position): bool
    {
        return false;
    }
}
