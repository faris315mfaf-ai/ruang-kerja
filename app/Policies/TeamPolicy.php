<?php

namespace App\Policies;

use App\Domain\Organization\Enums\Permission;
use App\Models\Team;
use App\Models\User;

/**
 * Everyone in the company may see teams (org chart); HR & Super Admin manage them.
 */
class TeamPolicy
{
    public function viewAny(User $actor): bool
    {
        return true;
    }

    public function view(User $actor, Team $team): bool
    {
        return $team->division()->withTrashed()->value('company_id') === $actor->company_id;
    }

    public function create(User $actor): bool
    {
        return $actor->hasPermission(Permission::OrganizationManage);
    }

    public function update(User $actor, Team $team): bool
    {
        return $this->view($actor, $team) && $actor->hasPermission(Permission::OrganizationManage);
    }

    public function delete(User $actor, Team $team): bool
    {
        return $this->update($actor, $team);
    }

    public function restore(User $actor, Team $team): bool
    {
        return $this->update($actor, $team);
    }

    public function forceDelete(User $actor, Team $team): bool
    {
        return false;
    }
}
