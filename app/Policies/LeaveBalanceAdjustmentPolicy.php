<?php

namespace App\Policies;

use App\Domain\Organization\Enums\Permission;
use App\Models\LeaveBalanceAdjustment;
use App\Models\User;

/**
 * Leave balance adjustments are HR bookkeeping: visible to the balance owner and
 * HR / Super Admin (requests.manage_flows); append-only (never edited or deleted).
 * Creating one is authorized by LeaveBalancePolicy::update on its balance.
 */
class LeaveBalanceAdjustmentPolicy
{
    public function viewAny(User $actor): bool
    {
        return $actor->hasPermission(Permission::RequestsManageFlows);
    }

    public function view(User $actor, LeaveBalanceAdjustment $adjustment): bool
    {
        $balance = $adjustment->loadMissing('balance.user')->balance;

        return $balance->user_id === $actor->id
            || ($balance->user->company_id === $actor->company_id && $actor->hasPermission(Permission::RequestsManageFlows));
    }

    public function update(User $actor, LeaveBalanceAdjustment $adjustment): bool
    {
        return false;
    }

    public function delete(User $actor, LeaveBalanceAdjustment $adjustment): bool
    {
        return false;
    }
}
