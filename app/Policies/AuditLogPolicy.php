<?php

namespace App\Policies;

use App\Domain\Organization\Enums\Permission;
use App\Models\AuditLog;
use App\Models\User;

/**
 * Audit logs are read-only and visible to Super Admin only (audit.view).
 */
class AuditLogPolicy
{
    public function viewAny(User $actor): bool
    {
        return $actor->hasPermission(Permission::AuditView);
    }

    public function view(User $actor, AuditLog $log): bool
    {
        return $actor->hasPermission(Permission::AuditView);
    }

    public function create(User $actor): bool
    {
        return false;
    }

    public function update(User $actor, AuditLog $log): bool
    {
        return false;
    }

    public function delete(User $actor, AuditLog $log): bool
    {
        return false;
    }
}
