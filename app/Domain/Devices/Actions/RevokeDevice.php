<?php

namespace App\Domain\Devices\Actions;

use App\Domain\Devices\Models\Device;
use App\Domain\Organization\Services\AuditLogger;
use App\Models\User;

/**
 * Removes a device ("Perangkat saya" → Cabut perangkat): the row is deleted,
 * which also drops the push token, and the revocation is audited. Authorization
 * is enforced by DevicePolicy before this action runs.
 */
final class RevokeDevice
{
    public function __construct(private readonly AuditLogger $audit) {}

    public function handle(User $actor, Device $device): void
    {
        $summary = [
            'platform' => $device->platform->value,
            'device_id_hash' => $device->device_id_hash,
            'name' => $device->name,
        ];

        $device->delete();

        $this->audit->log('device.revoked', $device, null, $summary, $actor);
    }
}
