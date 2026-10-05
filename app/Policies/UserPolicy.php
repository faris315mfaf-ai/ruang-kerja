<?php

namespace App\Policies;

use App\Domain\Organization\Enums\Permission;
use App\Domain\Organization\Enums\Role;
use App\Models\User;

/**
 * Employees. Lists must also go through User::visibleTo($actor).
 *
 * - HR & Super Admin manage employees (employees.manage).
 * - HR, Direksi, Super Admin see everyone (employees.view).
 * - Kepala Divisi sees their division; everyone sees themselves and direct reports.
 * - Only a Super Admin may edit a Super Admin or grant/revoke super_admin, direksi
 *   or hr; HR may grant/revoke kepala_divisi and anggota. Nobody changes their own roles.
 * - Employees are never hard-deleted: deactivate instead.
 */
class UserPolicy
{
    /**
     * Employee list (scoped). Anggota have no list — only their own record.
     */
    public function viewAny(User $actor): bool
    {
        return $actor->hasPermission(Permission::EmployeesView)
            || $actor->hasRole(Role::KepalaDivisi)
            || $actor->ledDivisions()->exists();
    }

    /**
     * Admin › Karyawan pages (list, form, import).
     */
    public function manage(User $actor): bool
    {
        return $actor->hasPermission(Permission::EmployeesManage);
    }

    public function view(User $actor, User $target): bool
    {
        return $actor->is($target)
            || User::query()->visibleTo($actor)->whereKey($target->id)->exists();
    }

    public function create(User $actor): bool
    {
        return $this->manage($actor);
    }

    public function update(User $actor, User $target): bool
    {
        return $this->manage($actor)
            && $actor->company_id === $target->company_id
            && ($actor->isSuperAdmin() || ! $target->isSuperAdmin());
    }

    /**
     * Set status to inactive/resigned. Nobody deactivates themselves.
     */
    public function deactivate(User $actor, User $target): bool
    {
        return ! $actor->is($target) && $this->update($actor, $target);
    }

    public function delete(User $actor, User $target): bool
    {
        return false;
    }

    /**
     * Grant or revoke one global role (check every role added or removed).
     */
    public function assignRole(User $actor, User $target, Role $role): bool
    {
        return ! $actor->is($target)
            && $this->update($actor, $target)
            && (! $role->onlySuperAdminAssigns() || $actor->isSuperAdmin());
    }

    /**
     * A user may only change their own theme preference.
     */
    public function updateTheme(User $actor, User $target): bool
    {
        return $actor->is($target);
    }

    /**
     * Own password / two-factor settings (settings/security, Fortify 2FA routes).
     * Only Super Admins have password sign-in; everyone else uses Google.
     */
    public function manageCredentials(User $actor, User $target): bool
    {
        return $actor->is($target) && $actor->isSuperAdmin();
    }
}
