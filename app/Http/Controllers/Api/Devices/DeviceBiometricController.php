<?php

namespace App\Http\Controllers\Api\Devices;

use App\Domain\Devices\Actions\UpdateDeviceBiometric;
use App\Domain\Devices\Models\Device;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\BiometricRequest;
use App\Models\User;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Gate;

/**
 * "Buka dengan sidik jari" switch per installation (DevicePolicy::update —
 * the owner's own devices only; others answer 403).
 */
class DeviceBiometricController extends Controller
{
    public function __invoke(#[CurrentUser] User $user, BiometricRequest $request, Device $device, UpdateDeviceBiometric $update): JsonResponse
    {
        Gate::authorize('update', $device);

        $update->handle($user, $device, $request->enabled());

        return response()->json([
            'message' => $device->biometric_login ? 'Buka dengan sidik jari diaktifkan.' : 'Buka dengan sidik jari dimatikan.',
            'device_id' => $device->id,
            'biometric_login' => $device->biometric_login,
        ]);
    }
}
