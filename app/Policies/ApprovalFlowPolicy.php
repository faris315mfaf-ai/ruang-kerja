<?php

namespace App\Policies;

use App\Domain\Organization\Enums\Permission;
use App\Models\ApprovalFlow;
use App\Models\User;

/**
 * Approval flows are configured by HR & Super Admin (requests.manage_flows).
 */
class ApprovalFlowPolicy
{
    public function viewAny(User $actor): bool
    {
        return $actor->hasPermission(Permission::RequestsManageFlows);
    }

    public function view(User $actor, ApprovalFlow $flow): bool
    {
        return $actor->company_id === $flow->company_id && $this->viewAny($actor);
    }

    public function create(User $actor): bool
    {
        return $this->viewAny($actor);
    }

    public function update(User $actor, ApprovalFlow $flow): bool
    {
        return $this->view($actor, $flow);
    }

    public function delete(User $actor, ApprovalFlow $flow): bool
    {
        return $this->view($actor, $flow);
    }

    public function forceDelete(User $actor, ApprovalFlow $flow): bool
    {
        return false;
    }
}
