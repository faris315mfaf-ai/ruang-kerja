<?php

use App\Domain\Devices\Models\Device;
use App\Domain\Organization\Enums\Role;
use App\Models\Company;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Contracts\Auth\Factory;
use Laravel\Sanctum\PersonalAccessToken;
use Tests\TestCase;

/*
| API v1 — "Perangkat saya": strictly the caller's own registrations
| (DevicePolicy), one Sanctum token per installation, `is_current` derived
| from the presented token (Device::sanctumTokenName).
*/

if (! defined('HASH_PONSEL')) {
    define('HASH_PONSEL', 'abababababababababababababababababababababababababababababababab');
} // 64 hex (SHA-256)
const HASH_TABLET = 'cdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcd';
const FCM_TOKEN = 'fcm-token-1-abcdefghijklmnopqrstuvwxyz0123456789';

beforeEach(function () {
    $this->seed(RoleSeeder::class);

    $company = Company::factory()->create(['google_domain' => 'kantor.test']);

    $this->rizky = User::factory()->forCompany($company)->withRole(Role::Anggota)->create(['email' => 'rizky@kantor.test']);
    $this->maya = User::factory()->forCompany($company)->withRole(Role::Anggota)->create(['email' => 'maya@kantor.test']);
});

/**
 * Signs `email` in through the real endpoint and returns the issued token.
 */
function masukPonsel(string $email, string $hash, string $name = 'Pixel 8'): string
{
    $token = test()->postJson('/api/v1/auth/login', [
        'email' => $email,
        'password' => 'password',
        'device' => [
            'platform' => 'android',
            'device_id_hash' => $hash,
            'name' => $name,
        ],
    ])->json('token');

    assert(is_string($token) && $token !== '');

    return $token;
}

/**
 * Starts calling as a (different) token. Between requests of one test the
 * sanctum guard instance — and its cached user — survives, so switching
 * tokens must drop the cached guards first (production boots a fresh app
 * per request and is unaffected).
 */
function pakaiToken(string $token): TestCase
{
    app(Factory::class)->forgetGuards();

    return test()->withToken($token);
}

test('lists only my own devices, the current one flagged', function () {
    $tokenRizky = masukPonsel('rizky@kantor.test', HASH_PONSEL);
    masukPonsel('maya@kantor.test', HASH_TABLET, 'Tab Maya');

    $deviceRizky = Device::query()->where('user_id', $this->rizky->id)->firstOrFail();

    $response = $this->withToken($tokenRizky)->getJson('/api/v1/perangkat');

    $response->assertOk()
        ->assertJsonCount(1, 'devices')
        ->assertJsonPath('devices.0.id', $deviceRizky->id)
        ->assertJsonPath('devices.0.platform', 'android')
        ->assertJsonPath('devices.0.platform_label', 'Android')
        ->assertJsonPath('devices.0.name', 'Pixel 8')
        ->assertJsonPath('devices.0.is_current', true)
        ->assertJsonPath('devices.0.has_push_token', false)
        ->assertJsonMissingPath('devices.0.push_token');

    // A second device of mine exists, but the token of the first keeps it current.
    // devices.0 is the tablet: the list is ordered by last_seen_at, newest first.
    $tokenTablet = masukPonsel('rizky@kantor.test', HASH_TABLET, 'Tab Rizky');
    expect(pakaiToken($tokenRizky)->getJson('/api/v1/perangkat')->json('devices.0.is_current'))->toBeFalse()
        ->and(pakaiToken($tokenTablet)->getJson('/api/v1/perangkat')->json('devices.0.is_current'))->toBeTrue();
});

test('revoking a device deletes it and kills its tokens', function () {
    $tokenPonsel = masukPonsel('rizky@kantor.test', HASH_PONSEL);
    $tokenTablet = masukPonsel('rizky@kantor.test', HASH_TABLET, 'Tab Rizky');

    $tablet = Device::query()->where('device_id_hash', HASH_TABLET)->firstOrFail();

    $this->withToken($tokenPonsel)
        ->deleteJson("/api/v1/perangkat/{$tablet->id}")
        ->assertOk()
        ->assertJsonPath('message', 'Perangkat dicabut.');

    expect(Device::query()->whereKey($tablet->id)->exists())->toBeFalse()
        ->and(pakaiToken($tokenTablet)->getJson('/api/v1/auth/saya')->status())->toBe(401)
        ->and(pakaiToken($tokenPonsel)->getJson('/api/v1/auth/saya')->status())->toBe(200)
        ->and(PersonalAccessToken::query()->where('tokenable_id', $this->rizky->id)->count())->toBe(1);
});

test("another user's device is untouchable", function () {
    $tokenRizky = masukPonsel('rizky@kantor.test', HASH_PONSEL);
    masukPonsel('maya@kantor.test', HASH_TABLET, 'Tab Maya');

    $punyaMaya = Device::query()->where('user_id', $this->maya->id)->firstOrFail();

    $this->withToken($tokenRizky)->deleteJson("/api/v1/perangkat/{$punyaMaya->id}")->assertForbidden();
    $this->withToken($tokenRizky)->putJson("/api/v1/perangkat/{$punyaMaya->id}/push-token", ['token' => FCM_TOKEN])->assertForbidden();

    expect(Device::query()->whereKey($punyaMaya->id)->exists())->toBeTrue()
        ->and($punyaMaya->refresh()->push_token)->toBeNull();
});

test('push-token stores the FCM token of my device', function () {
    $token = masukPonsel('rizky@kantor.test', HASH_PONSEL);
    $device = Device::query()->where('user_id', $this->rizky->id)->firstOrFail();

    $this->withToken($token)
        ->putJson("/api/v1/perangkat/{$device->id}/push-token", ['token' => FCM_TOKEN])
        ->assertOk()
        ->assertJsonPath('message', 'Token push diperbarui.');

    expect($device->refresh()->push_token)->toBe(FCM_TOKEN);

    // Rotation replaces the previous value.
    $baru = str_replace('1', '2', FCM_TOKEN);
    $this->withToken($token)->putJson("/api/v1/perangkat/{$device->id}/push-token", ['token' => $baru])->assertOk();
    expect($device->refresh()->push_token)->toBe($baru);
});

test('push-token validates its input in Indonesian', function () {
    $token = masukPonsel('rizky@kantor.test', HASH_PONSEL);
    $device = Device::query()->where('user_id', $this->rizky->id)->firstOrFail();

    $this->withToken($token)
        ->putJson("/api/v1/perangkat/{$device->id}/push-token", ['token' => 'pendek'])
        ->assertUnprocessable()
        ->assertJsonPath('errors.token.0', 'Token push tidak valid.');

    expect($device->refresh()->push_token)->toBeNull();
});

test('device endpoints reject requests without a token', function () {
    $device = Device::factory()->for($this->rizky)->create();

    $this->getJson('/api/v1/perangkat')->assertUnauthorized();
    $this->deleteJson("/api/v1/perangkat/{$device->id}")->assertUnauthorized();
    $this->putJson("/api/v1/perangkat/{$device->id}/push-token", ['token' => FCM_TOKEN])->assertUnauthorized();

    expect(Device::query()->whereKey($device->id)->exists())->toBeTrue();
});

test('push-token rejects values longer than the column holds', function () {
    $token = masukPonsel('rizky@kantor.test', HASH_PONSEL);
    $device = Device::query()->where('user_id', $this->rizky->id)->firstOrFail();

    $this->withToken($token)
        ->putJson("/api/v1/perangkat/{$device->id}/push-token", ['token' => str_repeat('a', 256)])
        ->assertUnprocessable()
        ->assertJsonPath('errors.token.0', 'Token push maksimal 255 karakter.');
});

test('logout clears the push token of the signed-out device and frees its slot', function () {
    $token = masukPonsel('rizky@kantor.test', HASH_PONSEL);
    $device = Device::query()->where('user_id', $this->rizky->id)->firstOrFail();
    $device->forceFill(['push_token' => FCM_TOKEN])->save();

    pakaiToken($token)->postJson('/api/v1/auth/logout')->assertOk();

    expect($device->refresh()->push_token)->toBeNull()
        ->and(PersonalAccessToken::query()->where('tokenable_id', $this->rizky->id)->count())->toBe(0);
});
