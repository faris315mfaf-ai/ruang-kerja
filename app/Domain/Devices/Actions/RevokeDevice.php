<?php

namespace App\Domain\Devices\Actions;

use App\Domain\Devices\Models\Device;
use App\Domain\Organization\Services\AuditLogger;
use App\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * Removes a device ("Perangkat saya" → Cabut perangkat): the row is deleted,
 * which also drops the push token, every Sanctum token of the installation is
 * revoked (Device::sanctumTokenName), and the revocation is audited.
 * Authorization is enforced by DevicePolicy before this action runs.
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

        $tokenId = $device->id;

        DB::transaction(function () use ($actor, $device, $tokenId): void {
            $device->delete();

            // All tokens of this installation die with it — including the one
            // the request itself carries (revoking the current device signs
            // the app out on its next call).
            $actor->tokens()->where('name', Device::sanctumTokenName($tokenId))->delete();
        });

        $this->audit->log('device.revoked', $device, null, $summary, $actor);
    }
}
