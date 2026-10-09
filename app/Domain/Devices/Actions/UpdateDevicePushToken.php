<?php

namespace App\Domain\Devices\Actions;

use App\Domain\Devices\Models\Device;
use Illuminate\Support\Facades\DB;

/**
 * Sets or clears the FCM push token of a device. FCM tokens identify one app
 * installation: if another row already holds the token (e.g. after a factory
 * reset gave the same installation a new device hash), it is released there
 * first so the token belongs to exactly one device.
 */
final class UpdateDevicePushToken
{
    public function handle(Device $device, ?string $pushToken): Device
    {
        return DB::transaction(function () use ($device, $pushToken): Device {
            if ($pushToken !== null) {
                Device::query()
                    ->where('push_token', $pushToken)
                    ->whereKeyNot($device->getKey())
                    ->update(['push_token' => null]);
            }

            $device->push_token = $pushToken;
            $device->save();

            return $device;
        });
    }
}
