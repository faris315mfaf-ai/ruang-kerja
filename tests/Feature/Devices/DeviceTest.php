<?php

use App\Domain\Devices\Actions\RegisterDevice;
use App\Domain\Devices\Actions\RevokeDevice;
use App\Domain\Devices\Actions\UpdateDevicePushToken;
use App\Domain\Devices\Enums\DevicePlatform;
use App\Domain\Devices\Models\Device;
use App\Domain\Organization\Enums\Role;
use App\Models\AuditLog;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\ValidationException;

const DEVICE_HASH_A = 'b0d5e2f1c3a49b678def0123456789abcdef0123456789abcdef0123456789ab';

/**
 * @param  array{name?: string, os_version?: string, app_version?: string, push_token?: string}  $extra
 */
function deviceRegister(User $user, DevicePlatform $platform, string $hash, array $extra = []): Device
{
    return app(RegisterDevice::class)->handle(
        $user,
        $platform,
        $hash,
        name: $extra['name'] ?? null,
        osVersion: $extra['os_version'] ?? null,
        appVersion: $extra['app_version'] ?? null,
        pushToken: $extra['push_token'] ?? null,
    );
}

test('register creates a device identified by its hash, not the raw identifier', function () {
    $user = User::factory()->create();

    $device = deviceRegister($user, DevicePlatform::Android, DEVICE_HASH_A, [
        'name' => 'Pixel 8',
        'os_version' => 'Android 15',
        'app_version' => '1.0.0',
        'push_token' => 'fcm-token-1',
    ]);

    expect($device->exists)->toBeTrue()
        ->and($device->user_id)->toBe($user->id)
        ->and($device->company_id)->toBe($user->company_id)
        ->and($device->platform)->toBe(DevicePlatform::Android)
        ->and($device->device_id_hash)->toBe(DEVICE_HASH_A)
        ->and($device->name)->toBe('Pixel 8')
        ->and($device->push_token)->toBe('fcm-token-1')
        ->and($device->last_seen_at)->not->toBeNull()
        ->and($device->biometric_login)->toBeFalse()
        ->and($device->is_trusted)->toBeFalse()
        ->and(Device::query()->where('user_id', $user->id)->count())->toBe(1);
});

test('registering the same device again refreshes it instead of duplicating', function () {
    $user = User::factory()->create();

    $first = deviceRegister($user, DevicePlatform::Android, DEVICE_HASH_A, ['name' => 'Pixel 8', 'push_token' => 'fcm-token-1']);
    $seenFirst = $first->last_seen_at;

    assert($seenFirst instanceof CarbonImmutable);
    // Stamps are stored with second precision; backdate so a refresh is provable.
    Device::query()->whereKey($first->id)->update(['last_seen_at' => $seenFirst->subMinutes(10)]);

    $second = deviceRegister($user, DevicePlatform::Android, DEVICE_HASH_A, ['os_version' => 'Android 16', 'push_token' => 'fcm-token-2']);
    $refreshed = Device::query()->findOrFail($second->id);

    expect($refreshed->id)->toBe($first->id)
        ->and(Device::query()->where('user_id', $user->id)->count())->toBe(1)
        ->and($refreshed->push_token)->toBe('fcm-token-2')
        ->and($refreshed->os_version)->toBe('Android 16')
        ->and($refreshed->name)->toBe('Pixel 8')
        // Only true if the register action moved last_seen_at back to "now".
        ->and($refreshed->last_seen_at !== null && $refreshed->last_seen_at->greaterThanOrEqualTo($seenFirst))->toBeTrue();
});

test('a user cannot register more than five devices', function () {
    $user = User::factory()->create();
    Device::factory()->count(5)->for($user)->create();

    $exception = null;

    try {
        deviceRegister($user, DevicePlatform::Android, DEVICE_HASH_A);
    } catch (ValidationException $caught) {
        $exception = $caught;
    }

    expect($exception)->toBeInstanceOf(ValidationException::class)
        ->and($exception?->errors()['device'][0] ?? null)->toContain('Maksimal 5 perangkat')
        ->and(Device::query()->where('user_id', $user->id)->count())->toBe(5);
});

test('re-registering an existing device stays allowed at the limit', function () {
    $user = User::factory()->create();
    $device = Device::factory()->for($user)->create();
    Device::factory()->count(4)->for($user)->create();

    $refreshed = deviceRegister($user, $device->platform, $device->device_id_hash, ['push_token' => 'fcm-token-new']);

    expect($refreshed->id)->toBe($device->id)
        ->and($refreshed->push_token)->toBe('fcm-token-new')
        ->and(Device::query()->where('user_id', $user->id)->count())->toBe(5);
});

test('the push token belongs to exactly one device after a takeover', function () {
    $user = User::factory()->create();
    $old = Device::factory()->for($user)->create(['push_token' => 'fcm-token-shared']);
    $new = Device::factory()->for($user)->withoutPushToken()->create();

    app(UpdateDevicePushToken::class)->handle($new, 'fcm-token-shared');

    expect($new->fresh()?->push_token)->toBe('fcm-token-shared')
        ->and($old->fresh()?->push_token)->toBeNull();
});

test('the push token can be cleared', function () {
    $device = Device::factory()->create(['push_token' => 'fcm-token-1']);

    app(UpdateDevicePushToken::class)->handle($device, null);

    expect($device->fresh()?->push_token)->toBeNull();
});

test('revoking a device deletes it and writes an audit entry', function () {
    $user = User::factory()->create();
    $device = Device::factory()->for($user)->create(['push_token' => 'fcm-token-1']);

    app(RevokeDevice::class)->handle($user, $device);

    $audit = AuditLog::query()->where('action', 'device.revoked')->first();

    expect(Device::query()->whereKey($device->id)->exists())->toBeFalse()
        ->and(Device::query()->where('push_token', 'fcm-token-1')->exists())->toBeFalse()
        ->and($audit)->not->toBeNull()
        ->and($audit?->user_id)->toBe($user->id)
        ->and($audit?->auditable_id)->toBe($device->id)
        ->and($audit->new_values['platform'] ?? null)->toBe('android');
});

test('only the owner may see and manage a device', function () {
    $owner = User::factory()->create();
    $other = User::factory()->create();
    $device = Device::factory()->for($owner)->create();

    $ownerGate = Gate::forUser($owner);
    $otherGate = Gate::forUser($other);

    expect($ownerGate->allows('viewAny', Device::class))->toBeTrue()
        ->and($ownerGate->allows('view', $device))->toBeTrue()
        ->and($ownerGate->allows('update', $device))->toBeTrue()
        ->and($ownerGate->allows('delete', $device))->toBeTrue()
        ->and($otherGate->allows('viewAny', Device::class))->toBeTrue()
        ->and($otherGate->allows('view', $device))->toBeFalse()
        ->and($otherGate->allows('update', $device))->toBeFalse()
        ->and($otherGate->allows('delete', $device))->toBeFalse();
});

test('hr and super admin deliberately get no access to other people devices', function () {
    $device = Device::factory()->create();

    $superAdmin = User::factory()->withRole(Role::SuperAdmin)->create();
    $hr = User::factory()->withRole(Role::Hr)->create();

    expect(Gate::forUser($superAdmin)->allows('view', $device))->toBeFalse()
        ->and(Gate::forUser($superAdmin)->allows('delete', $device))->toBeFalse()
        ->and(Gate::forUser($hr)->allows('view', $device))->toBeFalse()
        ->and(Gate::forUser($hr)->allows('update', $device))->toBeFalse();
});

test('an inactive owner loses access to their device list', function () {
    $user = User::factory()->resigned()->create();
    $device = Device::factory()->for($user)->create();

    expect(Gate::forUser($user)->allows('viewAny', Device::class))->toBeFalse()
        ->and(Gate::forUser($user)->allows('view', $device))->toBeTrue();
});

test('the list scope returns only the viewer devices, newest first', function () {
    $user = User::factory()->create();
    $other = User::factory()->create();
    $older = Device::factory()->for($user)->create(['last_seen_at' => now()->subDay()]);
    $newest = Device::factory()->for($user)->create(['last_seen_at' => now()]);
    Device::factory()->for($other)->create();

    $ids = Device::query()->visibleTo($user)->pluck('id');

    expect($ids)->toHaveCount(2)
        ->and($ids)->toContain($older->id)
        ->and($ids->first())->toBe($newest->id);
});
