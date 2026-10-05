<?php

namespace App\Policies;

use App\Domain\Attendance\Models\Kiosk;
use App\Domain\Organization\Enums\Permission;
use App\Models\User;

/**
 * Lobby kiosks are managed by HR & Super Admin (attendance.manage) of the
 * same company. The kiosk device itself authenticates with the `kiosk`
 * guard and never reaches these checks.
 */
class KioskPolicy
{
    public function viewAny(User $actor): bool
    {
        return $actor->hasPermission(Permission::AttendanceManage);
    }

    public function create(User $actor): bool
    {
        return $this->viewAny($actor);
    }

    public function update(User $actor, Kiosk $kiosk): bool
    {
        return $actor->company_id === $kiosk->company_id && $this->viewAny($actor);
    }

    public function activate(User $actor, Kiosk $kiosk): bool
    {
        return $this->update($actor, $kiosk) && $kiosk->is_active;
    }

    public function delete(User $actor, Kiosk $kiosk): bool
    {
        return $this->update($actor, $kiosk);
    }
}
