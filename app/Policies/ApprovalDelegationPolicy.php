<?php

namespace App\Policies;

use App\Domain\Organization\Enums\Permission;
use App\Models\ApprovalDelegation;
use App\Models\User;

/**
 * Each approver manages their own delegations; HR & Super Admin may end any in the company.
 */
class ApprovalDelegationPolicy
{
    public function viewAny(User $actor): bool
    {
        return $actor->isActive();
    }

    public function view(User $actor, ApprovalDelegation $delegation): bool
    {
        return $delegation->delegator_id === $actor->id
            || $delegation->delegate_id === $actor->id
            || $this->managesCompanyOf($actor, $delegation);
    }

    public function create(User $actor): bool
    {
        return $actor->isActive();
    }

    public function delete(User $actor, ApprovalDelegation $delegation): bool
    {
        return $delegation->delegator_id === $actor->id || $this->managesCompanyOf($actor, $delegation);
    }

    private function managesCompanyOf(User $actor, ApprovalDelegation $delegation): bool
    {
        return $actor->hasPermission(Permission::RequestsManageFlows)
            && $delegation->delegator->company_id === $actor->company_id;
    }
}
