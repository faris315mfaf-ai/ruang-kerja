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
 * - Everyone changes their own password; HR/Super Admin set others' (setPassword),
 *   but only a Super Admin sets the password of super_admin/direksi/hr accounts
 *   (audit R-06).
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
     * Own password (Pengaturan › Keamanan): every employee signs in with a
     * password (owner decision 6 Oct 2026), so everyone manages their own.
     */
    public function manageCredentials(User $actor, User $target): bool
    {
        return $actor->is($target) && $actor->isActive();
    }

    /**
     * Own two-factor settings (Fortify 2FA routes, password confirmation):
     * TOTP is required for — and only offered to — Super Admins.
     */
    public function manageTwoFactor(User $actor, User $target): bool
    {
        return $actor->is($target) && $actor->isSuperAdmin();
    }

    /**
     * HR sets another employee's password (Admin › Karyawan › Atur kata sandi).
     * Never one's own (that is Pengaturan › Keamanan, with the current password).
     * Audit R-06: a password is a way in, so accounts holding a role only a
     * Super Admin may grant (super_admin, direksi, hr) get theirs set by a
     * Super Admin only. HR keeps approving "Lupa kata sandi" — there the
     * account owner types the new password themselves.
     */
    public function setPassword(User $actor, User $target): bool
    {
        return ! $actor->is($target)
            && $this->update($actor, $target)
            && (! $target->hasAnyRole(Role::superAdminSetsPassword()) || $actor->isSuperAdmin());
    }
}
