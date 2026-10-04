<?php

namespace App\Policies;

use App\Domain\Organization\Enums\Permission;
use App\Models\LeaveBalance;
use App\Models\User;

/**
 * Own balance for everyone; all balances for HR & Super Admin (requests.manage_flows),
 * read-only for requests.view_all.
 */
class LeaveBalancePolicy
{
    public function viewAny(User $actor): bool
    {
        return $actor->hasPermission(Permission::RequestsManageFlows);
    }

    public function view(User $actor, LeaveBalance $balance): bool
    {
        if ($balance->user_id === $actor->id) {
            return true;
        }

        return $balance->user->company_id === $actor->company_id
            && ($actor->hasPermission(Permission::RequestsManageFlows) || $actor->hasPermission(Permission::RequestsViewAll));
    }

    /**
     * Run the yearly generator from the admin screen.
     */
    public function create(User $actor): bool
    {
        return $actor->hasPermission(Permission::RequestsManageFlows);
    }

    public function update(User $actor, LeaveBalance $balance): bool
    {
        return $balance->user->company_id === $actor->company_id && $actor->hasPermission(Permission::RequestsManageFlows);
    }

    public function delete(User $actor, LeaveBalance $balance): bool
    {
        return false;
    }
}
