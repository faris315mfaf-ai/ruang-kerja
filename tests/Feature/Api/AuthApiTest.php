<?php

use App\Domain\Auth\Actions\AuthenticateEmployee;
use App\Domain\Devices\Models\Device;
use App\Domain\Organization\Enums\Role;
use App\Domain\Organization\Enums\UserStatus;
use App\Domain\Organization\Enums\WorkMode;
use App\Models\Company;
use App\Models\Division;
use App\Models\Position;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Contracts\Auth\Factory;
use Illuminate\Testing\TestResponse;
use Laravel\Sanctum\PersonalAccessToken;
use Tests\TestCase;

/*
| API v1 — authentication for the mobile app. Credentials run through the
| web mechanism (AuthenticateEmployee), the installation is registered and
| receives a Sanctum token named after its device (Device::sanctumTokenName).
*/

const HASH_PONSEL = 'abababababababababababababababababababababababababababababababab'; // 64 hex (SHA-256)
const HASH_PONSEL_LAIN = 'cdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcd';

beforeEach(function () {
    $this->seed(RoleSeeder::class);

    $this->company = Company::factory()->create(['google_domain' => 'kantor.test']);
    $this->divisi = Division::factory()->forCompany($this->company)->create(['name' => 'Operasional']);
    $this->jabatan = Position::factory()->create(['company_id' => $this->company->id, 'name' => 'Staf Operasional']);

    $this->user = User::factory()
        ->forCompany($this->company)
        ->withRole(Role::Anggota)
        ->create([
            'name' => 'Rizky Aditya',
            'email' => 'rizky@kantor.test',
            'division_id' => $this->divisi->id,
            'position_id' => $this->jabatan->id,
            'work_mode' => WorkMode::Hybrid,
        ]);
});

/**
 * @param  array<string, mixed>  $device
 */
function apiLogin(string $email = 'rizky@kantor.test', string $password = 'password', array $device = []): TestResponse
{
    return test()->postJson('/api/v1/auth/login', [
        'email' => $email,
        'password' => $password,
        'device' => $device + [
            'platform' => 'android',
            'device_id_hash' => HASH_PONSEL,
            'name' => 'Pixel 8',
            'os_version' => 'Android 15',
            'app_version' => '1.0.0',
        ],
    ]);
}

/**
 * Starts calling as a (different) token. Between requests of one test the
 * sanctum guard instance — and its cached user — survives, so switching
 * tokens must drop the cached guards first (production boots a fresh app
 * per request and is unaffected).
 */
function sebagaiToken(string $token): TestCase
{
    app(Factory::class)->forgetGuards();

    return test()->withToken($token);
}

test('login issues a token and registers the device', function () {
    $response = apiLogin();

    $device = Device::query()->where('user_id', $this->user->id)->first();

    expect($device)->not->toBeNull()
        ->and($device->device_id_hash)->toBe(HASH_PONSEL)
        ->and($device->platform->value)->toBe('android')
        ->and($device->name)->toBe('Pixel 8')
        ->and($device->push_token)->toBeNull()
        ->and($this->user->refresh()->last_login_at)->not->toBeNull();

    $token = PersonalAccessToken::query()
        ->where('tokenable_id', $this->user->id)
        ->where('name', Device::sanctumTokenName($device->id))
        ->first();

    expect($token)->not->toBeNull()
        ->and($response->status())->toBe(200)
        ->and($response->json('token'))->toBeString()
        ->and($response->json('user'))->toBe([
            'id' => $this->user->id,
            'name' => 'Rizky Aditya',
            'email' => 'rizky@kantor.test',
            'jabatan' => 'Staf Operasional',
            'divisi' => 'Operasional',
            'work_mode' => ['value' => 'hybrid', 'label' => 'Hybrid'],
        ]);

    // The issued token really authenticates.
    $this->withToken($response->json('token'))
        ->getJson('/api/v1/auth/saya')
        ->assertOk()
        ->assertJsonPath('user.id', $this->user->id);
});

test('re-login on the same device replaces its previous token', function () {
    $first = apiLogin()->json('token');
    $second = apiLogin()->json('token');

    expect($second)->not->toBe($first)
        ->and(PersonalAccessToken::query()->where('tokenable_id', $this->user->id)->count())->toBe(1);

    // The stale token no longer authenticates.
    $this->withToken($first)->getJson('/api/v1/auth/saya')->assertUnauthorized();
    $this->withToken($second)->getJson('/api/v1/auth/saya')->assertOk();
});

test('wrong credentials answer a generic 422 that hides the account', function (string $email) {
    $response = apiLogin(email: $email, password: 'sandisalah');

    $response->assertUnprocessable()
        ->assertJsonPath('errors.email.0', AuthenticateEmployee::INVALID_CREDENTIALS);

    // No token, no device, no bookkeeping for a failed sign-in.
    expect(PersonalAccessToken::query()->count())->toBe(0)
        ->and(Device::query()->count())->toBe(0)
        ->and($this->user->refresh()->last_login_at)->toBeNull();
})->with([
    'alamat terdaftar' => 'rizky@kantor.test',
    'alamat tidak dikenal' => 'hantu@kantor.test',
]);

test('inactive employees cannot sign in', function () {
    $this->user->forceFill(['status' => UserStatus::Inactive])->save();

    apiLogin()->assertUnprocessable()
        ->assertJsonPath('errors.email.0', AuthenticateEmployee::INVALID_CREDENTIALS);

    expect(PersonalAccessToken::query()->count())->toBe(0)
        ->and(Device::query()->count())->toBe(0);
});

test('an account that must change its password is rejected with a 403 code', function () {
    $this->user->forceFill(['password_change_required' => true])->save();

    apiLogin()->assertStatus(403)
        ->assertJsonPath('code', 'password_change_required')
        ->assertJsonPath('message', 'Ganti kata sandi lewat web terlebih dahulu.');

    expect(PersonalAccessToken::query()->count())->toBe(0)
        ->and(Device::query()->count())->toBe(0);
});

test('a Super Admin is rejected: TOTP is not supported by the app yet', function () {
    $admin = User::factory()->forCompany($this->company)->withRole(Role::SuperAdmin)->create(['email' => 'admin@kantor.test']);

    apiLogin(email: $admin->email)->assertStatus(403)
        ->assertJsonPath('code', 'two_factor_required');

    expect(PersonalAccessToken::query()->count())->toBe(0);
});

test('a deactivated employee loses API access on the next request', function () {
    $token = apiLogin()->json('token');

    $this->user->forceFill(['status' => UserStatus::Resigned])->save();

    $this->withToken($token)->getJson('/api/v1/auth/saya')->assertUnauthorized();
});

test('logout revokes only the token of this device', function () {
    $tokenPonsel = apiLogin(device: ['device_id_hash' => HASH_PONSEL])->json('token');
    $tokenTablet = apiLogin(device: ['device_id_hash' => HASH_PONSEL_LAIN, 'name' => 'Tab'])->json('token');

    sebagaiToken($tokenTablet)->postJson('/api/v1/auth/logout')->assertOk();

    sebagaiToken($tokenTablet)->getJson('/api/v1/auth/saya')->assertUnauthorized();
    sebagaiToken($tokenPonsel)->getJson('/api/v1/auth/saya')->assertOk();
});

test('protected endpoints reject requests without a token', function () {
    $this->getJson('/api/v1/auth/saya')->assertUnauthorized();
    $this->postJson('/api/v1/auth/logout')->assertUnauthorized();
    $this->getJson('/api/v1/perangkat')->assertUnauthorized();
});
