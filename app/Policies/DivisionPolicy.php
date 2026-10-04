<?php

namespace App\Policies;

use App\Domain\Organization\Enums\Permission;
use App\Models\Division;
use App\Models\User;

/**
 * Everyone in the company may see divisions (org chart); HR & Super Admin manage them.
 */
class DivisionPolicy
{
    public function viewAny(User $actor): bool
    {
        return true;
    }

    public function view(User $actor, Division $division): bool
    {
        return $actor->company_id === $division->company_id;
    }

    public function create(User $actor): bool
    {
        return $actor->hasPermission(Permission::OrganizationManage);
    }

    public function update(User $actor, Division $division): bool
    {
        return $this->view($actor, $division) && $actor->hasPermission(Permission::OrganizationManage);
    }

    /**
     * Soft delete. The Action must still refuse divisions that have members or teams.
     */
    public function delete(User $actor, Division $division): bool
    {
        return $this->update($actor, $division);
    }

    public function restore(User $actor, Division $division): bool
    {
        return $this->update($actor, $division);
    }

    public function forceDelete(User $actor, Division $division): bool
    {
        return false;
    }
}
