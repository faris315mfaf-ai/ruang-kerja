<?php

namespace App\Domain\Devices\Actions;

use App\Domain\Devices\Enums\DevicePlatform;
use App\Domain\Devices\Models\Device;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Registers (or refreshes) one installation of the app for a user.
 *
 * The pair (user, device_id_hash) is unique: registering the same device again
 * refreshes its metadata, push token and last-seen time instead of creating a
 * new row. A user may hold at most MAX_DEVICES_PER_USER devices; the check
 * runs under an advisory lock so parallel registrations cannot exceed it.
 */
final class RegisterDevice
{
    public const int MAX_DEVICES_PER_USER = 5;

    /**
     * @throws ValidationException when the hash is malformed or the user already registered the maximum number of devices
     */
    public function handle(
        User $user,
        DevicePlatform $platform,
        string $deviceIdHash,
        ?string $name = null,
        ?string $osVersion = null,
        ?string $appVersion = null,
        ?string $pushToken = null,
    ): Device {
        $deviceIdHash = strtolower(trim($deviceIdHash));

        if (preg_match('/^[0-9a-f]{64}$/', $deviceIdHash) !== 1) {
            throw ValidationException::withMessages([
                'device' => 'Identitas perangkat tidak valid.',
            ]);
        }

        $pushToken = $pushToken === null ? null : trim($pushToken);

        return DB::transaction(function () use ($user, $platform, $deviceIdHash, $name, $osVersion, $appVersion, $pushToken): Device {
            // Serialize registrations of the same user (advisory lock releases with the transaction).
            DB::select('select pg_advisory_xact_lock(hashtextextended(?, 0))', ['devices.register:'.$user->id]);

            // Nullable fields only overwrite when the client sends a value:
            // a re-register without a push token must not wipe the old one.
            $attributes = array_filter([
                'name' => $name,
                'os_version' => $osVersion,
                'app_version' => $appVersion,
                'push_token' => $pushToken,
            ], static fn (mixed $value): bool => $value !== null);

            $device = Device::query()
                ->where('user_id', $user->id)
                ->where('device_id_hash', $deviceIdHash)
                ->first();

            if ($device !== null) {
                $device->fill($attributes);
                $device->last_seen_at = now();
                $device->save();

                if ($pushToken !== null) {
                    // The FCM token identifies one installation: a reinstall can
                    // rotate the device hash while keeping the token, so the row
                    // still holding it must release it first (unique index).
                    app(UpdateDevicePushToken::class)->handle($device->refresh(), $pushToken);

                    return $device->refresh();
                }

                return $device;
            }

            if (Device::query()->where('user_id', $user->id)->count() >= self::MAX_DEVICES_PER_USER) {
                throw ValidationException::withMessages([
                    'device' => sprintf('Maksimal %d perangkat dapat didaftarkan per akun. Cabut salah satu perangkat di "Perangkat saya" terlebih dahulu.', self::MAX_DEVICES_PER_USER),
                ]);
            }

            return Device::query()->create([
                'user_id' => $user->id,
                'company_id' => $user->company_id,
                'platform' => $platform,
                'device_id_hash' => $deviceIdHash,
                'last_seen_at' => now(),
                ...$attributes,
            ]);
        });
    }
}
