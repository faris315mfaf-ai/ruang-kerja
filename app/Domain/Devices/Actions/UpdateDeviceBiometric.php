<?php

namespace App\Domain\Devices\Actions;

use App\Domain\Devices\Models\Device;
use App\Domain\Organization\Services\AuditLogger;
use App\Models\User;

/**
 * Turns "Buka dengan sidik jari" on or off for ONE installation. The flag is
 * only a server-side marker of the user's choice on that device; the biometric
 * check itself (Keystore key bound to biometrics) lives in the app. Audited.
 * Authorization is the caller's job (DevicePolicy::update).
 */
final class UpdateDeviceBiometric
{
    public function __construct(private readonly AuditLogger $audit) {}

    public function handle(User $actor, Device $device, bool $enabled): Device
    {
        if ($device->biometric_login === $enabled) {
            return $device;
        }

        $device->biometric_login = $enabled;
        $device->save();

        $this->audit->log(
            'device.biometric_changed',
            $device,
            ['biometric_login' => ! $enabled],
            ['biometric_login' => $enabled],
            $actor,
        );

        return $device;
    }
}
