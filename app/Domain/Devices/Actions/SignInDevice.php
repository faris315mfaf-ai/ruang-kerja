<?php

namespace App\Domain\Devices\Actions;

use App\Domain\Devices\Enums\DevicePlatform;
use App\Domain\Devices\Models\Device;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * API sign-in of one installation: registers (or refreshes) the device and
 * issues its Sanctum token — one live token per installation
 * (Device::sanctumTokenName), the previous one is replaced.
 *
 * Everything runs in one transaction under RegisterDevice's per-user advisory
 * lock (held until this outer transaction commits), so two parallel logins
 * from the same installation can never leave two live tokens behind.
 */
final class SignInDevice
{
    public function __construct(private readonly RegisterDevice $registerDevice) {}

    /**
     * @return array{device: Device, token: string}
     *
     * @throws ValidationException from RegisterDevice (malformed hash, device limit)
     */
    public function handle(
        User $user,
        DevicePlatform $platform,
        string $deviceIdHash,
        ?string $name = null,
        ?string $osVersion = null,
        ?string $appVersion = null,
    ): array {
        return DB::transaction(function () use ($user, $platform, $deviceIdHash, $name, $osVersion, $appVersion): array {
            $device = $this->registerDevice->handle(
                $user,
                $platform,
                $deviceIdHash,
                name: $name,
                osVersion: $osVersion,
                appVersion: $appVersion,
            );

            $tokenName = Device::sanctumTokenName($device->id);
            $user->tokens()->where('name', $tokenName)->delete();

            return [
                'device' => $device,
                'token' => $user->createToken($tokenName)->plainTextToken,
            ];
        });
    }
}
