<?php

namespace App\Http\Controllers\Api\Devices;

use App\Domain\Devices\Actions\RevokeDevice;
use App\Domain\Devices\Actions\UpdateDevicePushToken;
use App\Domain\Devices\Models\Device;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\PushTokenRequest;
use App\Models\User;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Gate;

/**
 * "Perangkat saya" for the mobile app (/api/v1/perangkat). Authorization goes
 * through DevicePolicy: strictly the owner's own registrations — HR and Super
 * Admin deliberately get nothing (privacy). The list is always scoped by
 * Device::scopeVisibleTo, `is_current` is derived from the caller's token
 * (Device::sanctumTokenName), and the push token itself is never returned.
 */
class DeviceController extends Controller
{
    public function __construct(
        private readonly RevokeDevice $revokeDevice,
        private readonly UpdateDevicePushToken $updatePushToken,
    ) {}

    /** The caller's own devices, most recently seen first. */
    public function index(#[CurrentUser] User $user): JsonResponse
    {
        Gate::authorize('viewAny', Device::class);

        $currentTokenName = $this->currentTokenName($user);

        $devices = Device::query()
            ->visibleTo($user)
            ->get()
            ->map(fn (Device $device): array => $this->serialize($device, $currentTokenName))
            ->all();

        return response()->json(['devices' => $devices]);
    }

    /** Revokes a device: its row (and push token) plus all of its Sanctum tokens. */
    public function destroy(#[CurrentUser] User $user, Device $device): JsonResponse
    {
        Gate::authorize('delete', $device);

        $this->revokeDevice->handle($user, $device);

        return response()->json(['message' => 'Perangkat dicabut.']);
    }

    /** Registers (or rotates) the FCM push token of the caller's own device. */
    public function updatePushToken(PushTokenRequest $request, Device $device): JsonResponse
    {
        Gate::authorize('update', $device);

        $this->updatePushToken->handle($device, $request->token());

        return response()->json(['message' => 'Token push diperbarui.']);
    }

    /**
     * @param  string  $currentTokenName  the token name the caller presented (routes require auth:sanctum, so always a real token)
     * @return array<string, mixed>
     */
    private function serialize(Device $device, string $currentTokenName): array
    {
        return [
            'id' => $device->id,
            'platform' => $device->platform->value,
            'platform_label' => $device->platform->label(),
            'name' => $device->name,
            'os_version' => $device->os_version,
            'app_version' => $device->app_version,
            'biometric_login' => $device->biometric_login,
            'has_push_token' => $device->push_token !== null,
            'is_current' => $currentTokenName === Device::sanctumTokenName($device->id),
            'last_seen_at' => $device->last_seen_at?->toIso8601String(),
            'created_at' => $device->created_at?->toIso8601String(),
        ];
    }

    /** Token name the caller presented. */
    private function currentTokenName(User $user): string
    {
        return $user->currentAccessToken()->name;
    }
}
