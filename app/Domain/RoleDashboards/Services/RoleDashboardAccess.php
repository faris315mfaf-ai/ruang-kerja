<?php

namespace App\Domain\RoleDashboards\Services;

use App\Domain\Organization\Enums\Role;
use App\Domain\RoleDashboards\Enums\DashboardRole;
use App\Models\Position;
use App\Models\User;

/**
 * Who may open which job dashboard (Gate `viewRoleDashboard`):
 *
 * - an active employee whose position carries that dashboard_role;
 * - Direksi and Super Admin: every key (to look over a job's shoulder).
 *
 * Everybody else gets a 404 — unlike the preview, which was open to all.
 */
final class RoleDashboardAccess
{
    public function can(User $user, DashboardRole $role): bool
    {
        if (! $user->isActive()) {
            return false;
        }

        return $this->seesAll($user) || $this->own($user) === $role;
    }

    /** Direksi & Super Admin open every job dashboard. */
    public function seesAll(User $user): bool
    {
        return $user->hasRole([Role::Direksi->value, Role::SuperAdmin->value]);
    }

    /** The job dashboard of the user's own position (one small PK query). */
    public function own(User $user): ?DashboardRole
    {
        if ($user->position_id === null) {
            return null;
        }

        // value() applies the model cast: an enum (or null) comes back.
        $value = Position::query()->whereKey($user->position_id)->value('dashboard_role');

        return $value instanceof DashboardRole ? $value : null;
    }

    /**
     * Whether the shell shows "Dashboard jabatan". `$own` is the dashboard role
     * of the position the caller already loaded (no extra query).
     */
    public function hasAny(User $user, ?DashboardRole $own): bool
    {
        return $user->isActive() && ($own !== null || $this->seesAll($user));
    }

    /**
     * Keys in the picker: every key for Direksi/Super Admin, else the own one.
     *
     * @return list<DashboardRole>
     */
    public function roles(User $user): array
    {
        if (! $user->isActive()) {
            return [];
        }

        if ($this->seesAll($user)) {
            return DashboardRole::cases();
        }

        $own = $this->own($user);

        return $own === null ? [] : [$own];
    }

    /**
     * Where `/peran` lands: the own position's dashboard, else the first key
     * for Direksi/Super Admin, else nothing (404).
     */
    public function landing(User $user): ?DashboardRole
    {
        if (! $user->isActive()) {
            return null;
        }

        return $this->own($user) ?? ($this->seesAll($user) ? DashboardRole::Dirut : null);
    }
}
