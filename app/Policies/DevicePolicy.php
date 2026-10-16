<?php

namespace App\Policies;

use App\Domain\Devices\Models\Device;
use App\Models\User;

/**
 * Devices are strictly personal: only the owner sees and manages their own
 * registrations. HR and Super Admin deliberately get nothing (privacy, UU PDP)
 * — the metadata of a device can betray when someone works and from where.
 * The list endpoint is always scoped to the actor's own rows (`Device::scopeVisibleTo`).
 */
class DevicePolicy
{
    public function viewAny(User $user): bool
    {
        return $user->isActive();
    }

    public function view(User $user, Device $device): bool
    {
        return $device->user_id === $user->id;
    }

    public function update(User $user, Device $device): bool
    {
        return $device->user_id === $user->id;
    }

    public function delete(User $user, Device $device): bool
    {
        return $device->user_id === $user->id;
    }
}
