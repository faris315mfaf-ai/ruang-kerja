<?php

namespace App\Policies;

use App\Domain\Organization\Enums\Permission;
use App\Models\PasswordResetRequest;
use App\Models\User;

/**
 * "Lupa kata sandi" requests (owner decision 6 Oct 2026). Lists go through
 * PasswordResetRequest::visibleTo($viewer), which applies the same rules.
 *
 * - HR & Super Admin (employees.manage) see and decide requests of their company.
 * - A Super Admin's request: only another Super Admin.
 * - Nobody decides their own request. Requests are created by guests (no policy).
 */
class PasswordResetRequestPolicy
{
    public function viewAny(User $actor): bool
    {
        return $actor->isActive() && $actor->hasPermission(Permission::EmployeesManage);
    }

    public function view(User $actor, PasswordResetRequest $request): bool
    {
        return $this->viewAny($actor)
            && $request->company_id === $actor->company_id
            && $request->user_id !== $actor->id
            && ($actor->isSuperAdmin() || $request->user?->isSuperAdmin() !== true);
    }

    /**
     * Approve or reject (the request must still be awaiting a decision: Action).
     */
    public function decide(User $actor, PasswordResetRequest $request): bool
    {
        return $this->view($actor, $request);
    }
}
