<?php

use App\Domain\Auth\Actions\ChangeOwnPassword;
use App\Domain\Auth\Actions\DecidePasswordReset;
use App\Domain\Auth\Services\ApiPasswordResetToken;
use App\Domain\Devices\Models\Device;
use App\Domain\Organization\Enums\Role;
use App\Domain\Organization\Enums\WorkMode;
use App\Models\AuditLog;
use App\Models\Company;
use App\Models\Division;
use App\Models\PasswordResetRequest;
use App\Models\Position;
use App\Models\Team;
use App\Models\User;
use Carbon\CarbonImmutable;
use Database\Seeders\RoleSeeder;
use Illuminate\Contracts\Auth\Factory;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Timebox;
use Illuminate\Testing\TestResponse;
use Laravel\Fortify\Fortify;
use Laravel\Sanctum\PersonalAccessToken;
use PragmaRX\Google2FA\Google2FA;
use Tests\TestCase;

/*
| API v1 — Bagian 1 (fondasi & akun), B1: profil lengkap (/auth/saya), tantangan
| TOTP (/auth/dua-faktor), ganti sandi sendiri (/auth/sandi), lupa sandi
| berpersetujuan HR (/auth/lupa-sandi*) dan konfigurasi publik (/konfigurasi).
*/

if (! defined('B1_HASH_A')) {
    define('B1_HASH_A', 'abababababababababababababababababababababababababababababababab');
}
if (! defined('B1_HASH_B')) {
    define('B1_HASH_B', 'cdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcd');
}
if (! defined('B1_TOTP_SECRET')) {
    define('B1_TOTP_SECRET', 'JBSWY3DPEHPK3PXP');
}

beforeEach(function () {
    $this->seed(RoleSeeder::class);

    // The timebox only equalizes timing; skip the sleep in tests.
    $this->app->bind(Timebox::class, fn () => new class extends Timebox
    {
        public function call(callable $callback, int $microseconds)
        {
            return $callback($this);
        }
    });

    $this->company = Company::factory()->create(['google_domain' => 'kantor.test']);
    $this->divisi = Division::factory()->forCompany($this->company)->create(['name' => 'Operasional']);
    $this->tim = Team::factory()->create(['division_id' => $this->divisi->id, 'name' => 'Tim Gudang']);
    $this->atasan = User::factory()->forCompany($this->company)->withRole(Role::KepalaDivisi)->create([
        'name' => 'Dimas Kepala',
        'division_id' => $this->divisi->id,
    ]);
    $this->jabatan = Position::factory()->create(['company_id' => $this->company->id, 'name' => 'Staf Operasional']);

    $this->user = User::factory()->forCompany($this->company)->withRole(Role::Anggota)->create([
        'name' => 'Rizky Aditya',
        'email' => 'rizky@kantor.test',
        'division_id' => $this->divisi->id,
        'team_id' => $this->tim->id,
        'position_id' => $this->jabatan->id,
        'manager_id' => $this->atasan->id,
        'work_mode' => WorkMode::Hybrid,
        'joined_at' => '2025-03-10',
    ]);
    $this->user->profile()->create(['employee_number' => 'EMP-00042']);
});

/**
 * @param  array<string, mixed>  $extra
 */
function b1Login(string $email = 'rizky@kantor.test', string $password = 'password', string $hash = B1_HASH_A, array $extra = []): TestResponse
{
    return test()->postJson('/api/v1/auth/login', [
        'email' => $email,
        'password' => $password,
        'device' => ['platform' => 'android', 'device_id_hash' => $hash, 'name' => 'Pixel 8', 'os_version' => 'Android 15', 'app_version' => '1.0.0'],
    ] + $extra);
}

function b1As(string $token): TestCase
{
    app(Factory::class)->forgetGuards();

    return test()->withToken($token);
}

function b1EnableTotp(User $user): void
{
    $user->forceFill([
        'two_factor_secret' => Fortify::currentEncrypter()->encrypt(B1_TOTP_SECRET),
        'two_factor_recovery_codes' => Fortify::currentEncrypter()->encrypt(json_encode(['pemulihan-satu', 'pemulihan-dua'])),
        'two_factor_confirmed_at' => now(),
    ])->save();
}

function b1Otp(): string
{
    return app(Google2FA::class)->getCurrentOtp(B1_TOTP_SECRET);
}

// ---------------------------------------------------------------- GET /auth/saya

test('saya returns the full profile and keeps the concise fields', function () {
    config(['features.chat' => true, 'features.okr' => false]);

    $token = b1Login()->assertOk()->json('token');

    $user = b1As($token)->getJson('/api/v1/auth/saya')->assertOk()->json('user');

    expect($user)->toMatchArray([
        // unchanged since Tahap 1
        'id' => $this->user->id,
        'name' => 'Rizky Aditya',
        'email' => 'rizky@kantor.test',
        'jabatan' => 'Staf Operasional',
        'divisi' => 'Operasional',
        'work_mode' => ['value' => 'hybrid', 'label' => 'Hybrid'],
        // Bagian 1
        'roles' => ['anggota'],
        'is_staff_only' => true,
        'position' => ['id' => $this->jabatan->id, 'name' => 'Staf Operasional'],
        'division' => ['id' => $this->divisi->id, 'name' => 'Operasional'],
        'team' => ['id' => $this->tim->id, 'name' => 'Tim Gudang'],
        'manager' => ['id' => $this->atasan->id, 'name' => 'Dimas Kepala'],
        'employee_number' => 'EMP-00042',
        'joined_at' => '2025-03-10',
        'led_division_ids' => [],
        'two_factor_enabled' => false,
        'password_change_required' => false,
    ])
        ->and($user['features'])->toHaveKeys(['chat', 'notes', 'meetings', 'okr', 'automation', 'role_dashboards'])
        ->and($user['features']['chat'])->toBeTrue()
        ->and($user['features']['okr'])->toBeFalse()
        ->and($user['password_hint'])->toBeString()
        // Staff never get a leave balance, anywhere.
        ->and($user)->not->toHaveKey('leave_balance')->not->toHaveKey('saldo_cuti');
});

test('saya of a division head lists roles and led divisions, and is not staff', function () {
    $token = b1Login(email: $this->atasan->email)->assertOk()->json('token');

    $user = b1As($token)->getJson('/api/v1/auth/saya')->assertOk()->json('user');

    expect($user['roles'])->toBe(['kepala_divisi'])
        ->and($user['is_staff_only'])->toBeFalse()
        ->and($user['led_division_ids'])->toContain($this->divisi->id)
        ->and($user['team'])->toBeNull()
        ->and($user['manager'])->toBeNull()
        ->and($user['employee_number'])->toBeNull();
});

// ------------------------------------------------------------- TOTP sign-in

test('an account with confirmed TOTP gets a challenge, not a token', function () {
    b1EnableTotp($this->user);

    $response = b1Login()->assertOk()
        ->assertJsonPath('two_factor_required', true)
        ->assertJsonPath('expires_in', 300);

    expect($response->json('challenge_token'))->toBeString()->toHaveLength(64)
        ->and($response->json())->not->toHaveKey('token')
        ->and(PersonalAccessToken::query()->count())->toBe(0)
        ->and(Device::query()->count())->toBe(0);
});

test('the right authenticator code completes the sign-in once', function () {
    b1EnableTotp($this->user);
    $challenge = b1Login()->json('challenge_token');

    $response = $this->postJson('/api/v1/auth/dua-faktor', ['challenge_token' => $challenge, 'code' => b1Otp()])
        ->assertOk()
        ->assertJsonPath('user.id', $this->user->id)
        ->assertJsonPath('password_change_required', false);

    expect($response->json('token'))->toBeString()
        ->and(Device::query()->where('user_id', $this->user->id)->sole()->device_id_hash)->toBe(B1_HASH_A)
        ->and($this->user->refresh()->last_login_at)->not->toBeNull();

    b1As($response->json('token'))->getJson('/api/v1/auth/saya')->assertOk()->assertJsonPath('user.two_factor_enabled', true);

    // Single use: the same challenge cannot be redeemed twice.
    $this->postJson('/api/v1/auth/dua-faktor', ['challenge_token' => $challenge, 'code' => b1Otp()])
        ->assertUnprocessable()->assertJsonPath('code', 'challenge_expired');
});

test('a wrong code is a 422, five wrong codes destroy the challenge', function () {
    b1EnableTotp($this->user);
    $challenge = b1Login()->json('challenge_token');

    foreach (range(1, 4) as $ignored) {
        $this->postJson('/api/v1/auth/dua-faktor', ['challenge_token' => $challenge, 'code' => '000000'])
            ->assertUnprocessable()
            ->assertJsonPath('errors.code.0', 'Kode autentikator atau kode pemulihan salah.');
    }

    $this->postJson('/api/v1/auth/dua-faktor', ['challenge_token' => $challenge, 'code' => '000000'])
        ->assertUnprocessable()->assertJsonPath('code', 'challenge_expired');

    // Even the right code is useless now (a minute later, past the throttle window).
    $this->travel(61)->seconds();
    $this->postJson('/api/v1/auth/dua-faktor', ['challenge_token' => $challenge, 'code' => b1Otp()])
        ->assertUnprocessable()->assertJsonPath('code', 'challenge_expired');

    expect(PersonalAccessToken::query()->count())->toBe(0)
        ->and(AuditLog::query()->where('action', 'user.login_failed')->count())->toBe(5);
});

test('the challenge expires after five minutes and unknown tokens are refused', function () {
    b1EnableTotp($this->user);
    $challenge = b1Login()->json('challenge_token');

    $this->travel(301)->seconds();

    $this->postJson('/api/v1/auth/dua-faktor', ['challenge_token' => $challenge, 'code' => b1Otp()])
        ->assertUnprocessable()->assertJsonPath('code', 'challenge_expired');
    $this->postJson('/api/v1/auth/dua-faktor', ['challenge_token' => str_repeat('x', 64), 'code' => '123456'])
        ->assertUnprocessable()->assertJsonPath('code', 'challenge_expired');
});

test('a recovery code works once and is replaced', function () {
    b1EnableTotp($this->user);
    $challenge = b1Login()->json('challenge_token');

    $this->postJson('/api/v1/auth/dua-faktor', ['challenge_token' => $challenge, 'recovery_code' => 'pemulihan-satu'])
        ->assertOk()->assertJsonStructure(['token']);

    expect($this->user->refresh()->recoveryCodes())->not->toContain('pemulihan-satu')->toContain('pemulihan-dua')
        ->and(AuditLog::query()->where('action', 'user.two_factor_recovery_code_used')->exists())->toBeTrue();

    $again = b1Login(hash: B1_HASH_B)->json('challenge_token');
    $this->postJson('/api/v1/auth/dua-faktor', ['challenge_token' => $again, 'recovery_code' => 'pemulihan-satu'])
        ->assertUnprocessable()->assertJsonPath('errors.code.0', 'Kode autentikator atau kode pemulihan salah.');
});

test('the code or a recovery code is required', function () {
    $this->postJson('/api/v1/auth/dua-faktor', ['challenge_token' => 'abc'])
        ->assertUnprocessable()
        ->assertJsonPath('errors.code.0', 'Masukkan kode autentikator atau kode pemulihan.');
    $this->postJson('/api/v1/auth/dua-faktor', ['code' => '123456'])->assertUnprocessable();
});

test('the two-factor endpoint is throttled to five attempts per minute per challenge', function () {
    b1EnableTotp($this->user);
    $challenge = b1Login()->json('challenge_token');

    foreach (range(1, 5) as $ignored) {
        $this->postJson('/api/v1/auth/dua-faktor', ['challenge_token' => $challenge, 'code' => '000000'])->assertUnprocessable();
    }

    $this->postJson('/api/v1/auth/dua-faktor', ['challenge_token' => $challenge, 'code' => '000000'])
        ->assertStatus(429)->assertJsonPath('code', 'two_factor_throttled');
});

test('the challenge is lost when the account is deactivated meanwhile', function () {
    b1EnableTotp($this->user);
    $challenge = b1Login()->json('challenge_token');

    $this->user->forceFill(['status' => 'inactive'])->save();

    $this->postJson('/api/v1/auth/dua-faktor', ['challenge_token' => $challenge, 'code' => b1Otp()])
        ->assertUnprocessable()->assertJsonPath('code', 'challenge_expired');
});

test('a Super Admin with confirmed TOTP can use the app, without TOTP they are told to set it up', function () {
    $admin = User::factory()->forCompany($this->company)->withRole(Role::SuperAdmin)->create(['email' => 'admin@kantor.test']);

    b1Login(email: $admin->email)->assertStatus(403)->assertJsonPath('code', 'two_factor_setup_required');
    expect(PersonalAccessToken::query()->count())->toBe(0);

    b1EnableTotp($admin);
    $challenge = b1Login(email: $admin->email)->assertOk()->assertJsonPath('two_factor_required', true)->json('challenge_token');

    $token = $this->postJson('/api/v1/auth/dua-faktor', ['challenge_token' => $challenge, 'code' => b1Otp()])
        ->assertOk()->json('token');

    b1As($token)->getJson('/api/v1/perangkat')->assertOk();
    b1As($token)->getJson('/api/v1/auth/saya')->assertOk()->assertJsonPath('user.roles', ['super_admin']);
});

// ---------------------------------------------------------- POST /auth/sandi

test('changing the password keeps this device and signs out the others', function () {
    $tokenA = b1Login(hash: B1_HASH_A)->json('token');
    $tokenB = b1Login(hash: B1_HASH_B)->json('token');
    Device::query()->where('device_id_hash', B1_HASH_A)->update(['push_token' => 'fcm-token-a']);
    Device::query()->where('device_id_hash', B1_HASH_B)->update(['push_token' => 'fcm-token-b']);

    $response = b1As($tokenA)->postJson('/api/v1/auth/sandi', [
        'current_password' => 'password',
        'password' => 'SandiBaruSaya123',
        'password_confirmation' => 'SandiBaruSaya123',
    ])->assertOk()
        ->assertJsonPath('password_change_required', false)
        ->assertJsonPath('user.id', $this->user->id);

    expect(Hash::check('SandiBaruSaya123', $this->user->refresh()->password))->toBeTrue()
        ->and(AuditLog::query()->where('action', 'user.password_changed')->count())->toBe(1)
        ->and(PersonalAccessToken::query()->where('tokenable_id', $this->user->id)->count())->toBe(1);

    $deviceA = Device::query()->where('device_id_hash', B1_HASH_A)->sole();
    $deviceB = Device::query()->where('device_id_hash', B1_HASH_B)->sole();
    expect($deviceA->push_token)->toBe('fcm-token-a')->and($deviceB->push_token)->toBeNull();

    b1As($tokenA)->getJson('/api/v1/auth/saya')->assertOk();
    b1As($tokenB)->getJson('/api/v1/auth/saya')->assertUnauthorized();

    b1Login(password: 'password', hash: B1_HASH_B)->assertUnprocessable();
    b1Login(password: 'SandiBaruSaya123', hash: B1_HASH_B)->assertOk();
});

test('changing the password validates the current one and the policy', function () {
    $token = b1Login()->json('token');

    $call = fn (array $body) => b1As($token)->postJson('/api/v1/auth/sandi', $body);

    $call(['current_password' => 'salah', 'password' => 'SandiBaruSaya123', 'password_confirmation' => 'SandiBaruSaya123'])
        ->assertUnprocessable()->assertJsonValidationErrors('current_password');
    $call(['current_password' => 'password', 'password' => 'SandiBaruSaya123', 'password_confirmation' => 'lain'])
        ->assertUnprocessable()->assertJsonValidationErrors('password');
    $call(['current_password' => 'password', 'password' => 'password', 'password_confirmation' => 'password'])
        ->assertUnprocessable()
        ->assertJsonPath('errors.password.0', 'Kata sandi baru harus berbeda dari kata sandi saat ini.');

    config(['auth.employee_default_password' => 'SandiBawaan123']);
    $call(['current_password' => 'password', 'password' => 'SandiBawaan123', 'password_confirmation' => 'SandiBawaan123'])
        ->assertUnprocessable()->assertJsonValidationErrors('password');

    expect(Hash::check('password', $this->user->refresh()->password))->toBeTrue();
});

test('changing the password needs a token', function () {
    $this->postJson('/api/v1/auth/sandi', [])->assertUnauthorized();
});

test('the forced password change can be done inside the app', function () {
    $this->user->forceFill(['password_change_required' => true])->save();

    // Without the opt-in the old behaviour stays: refused, no token.
    b1Login()->assertForbidden()->assertJsonPath('code', 'password_change_required');
    expect(PersonalAccessToken::query()->count())->toBe(0);

    $response = b1Login(extra: ['supports_password_change' => true])->assertOk()
        ->assertJsonPath('password_change_required', true);
    $token = $response->json('token');

    // Everything else is closed, the profile, logout and the change itself are open.
    b1As($token)->getJson('/api/v1/perangkat')->assertForbidden()->assertJsonPath('code', 'password_change_required');
    b1As($token)->getJson('/api/v1/auth/saya')->assertOk()->assertJsonPath('user.password_change_required', true);

    b1As($token)->postJson('/api/v1/auth/sandi', [
        'current_password' => 'password',
        'password' => 'SandiPilihanSaya1',
        'password_confirmation' => 'SandiPilihanSaya1',
    ])->assertOk()->assertJsonPath('user.password_change_required', false);

    b1As($token)->getJson('/api/v1/perangkat')->assertOk();
    expect($this->user->refresh()->password_change_required)->toBeFalse();
});

// ------------------------------------------- Lupa kata sandi (persetujuan HR)

function b1RequestReset(string $email = 'rizky@kantor.test'): string
{
    return test()->postJson('/api/v1/auth/lupa-sandi', ['email' => $email])
        ->assertOk()->json('request_token');
}

function b1ResetStatus(string $token): TestResponse
{
    return test()->getJson('/api/v1/auth/lupa-sandi/status', ['X-Reset-Token' => $token]);
}

function b1Decide(User $employee, bool $approve, ?string $reason = null): void
{
    $hr = User::query()->where('company_id', $employee->company_id)->whereHas('roles', fn ($q) => $q->where('name', Role::Hr->value))->first()
        ?? User::factory()->forCompany($employee->company)->withRole(Role::Hr)->create();

    $request = PasswordResetRequest::query()->where('user_id', $employee->id)->latest('created_at')->firstOrFail();
    app(DecidePasswordReset::class)->handle($hr, $request, $approve, $reason);
}

test('forgot password: request, HR approves, the app sets a new password and is signed in', function () {
    $oldToken = b1Login(hash: B1_HASH_B)->json('token');

    $request = b1RequestReset();

    expect($request)->toBeString();
    $pending = b1ResetStatus($request)->assertOk()->assertJsonPath('status', 'pending')->json();
    expect($pending)->toHaveKey('expires_at')->not->toHaveKey('setup_token');
    expect(PasswordResetRequest::query()->where('user_id', $this->user->id)->sole()->status->value)->toBe('pending');

    b1Decide($this->user, true);

    $approved = b1ResetStatus($request)->assertOk()->assertJsonPath('status', 'approved')->json();
    expect($approved['setup_token'])->toBeString()
        ->and($approved['setup_expires_at'])->toBeString()
        ->and($approved['password_hint'])->toBeString();

    $done = $this->postJson('/api/v1/auth/lupa-sandi/selesai', [
        'setup_token' => $approved['setup_token'],
        'password' => 'SandiSetelahReset1',
        'password_confirmation' => 'SandiSetelahReset1',
        'device' => ['platform' => 'android', 'device_id_hash' => B1_HASH_A, 'name' => 'Pixel 8'],
    ])->assertOk()->assertJsonPath('user.id', $this->user->id)->assertJsonPath('password_change_required', false);

    expect($done->json('token'))->toBeString()
        ->and(Hash::check('SandiSetelahReset1', $this->user->refresh()->password))->toBeTrue()
        // every earlier sign-in is gone; only the one just made lives
        ->and(PersonalAccessToken::query()->where('tokenable_id', $this->user->id)->count())->toBe(1)
        ->and(AuditLog::query()->where('action', 'user.password_reset_completed')->exists())->toBeTrue();

    b1As($oldToken)->getJson('/api/v1/auth/saya')->assertUnauthorized();
    b1As($done->json('token'))->getJson('/api/v1/auth/saya')->assertOk();

    // The setup token is single use; the request is finished.
    $this->postJson('/api/v1/auth/lupa-sandi/selesai', [
        'setup_token' => $approved['setup_token'],
        'password' => 'LainLagi12345',
        'password_confirmation' => 'LainLagi12345',
        'device' => ['platform' => 'android', 'device_id_hash' => B1_HASH_A],
    ])->assertUnprocessable()->assertJsonPath('code', 'setup_token_invalid');
    b1ResetStatus($request)->assertJsonPath('status', 'expired');
});

test('forgot password: a rejection shows the reason and is final', function () {
    $request = b1RequestReset();

    b1Decide($this->user, false, 'Hubungi HR langsung.');

    b1ResetStatus($request)->assertOk()
        ->assertJsonPath('status', 'rejected')
        ->assertJsonPath('reject_reason', 'Hubungi HR langsung.')
        ->assertJsonMissingPath('setup_token');
});

test('forgot password: unknown addresses look exactly like real ones', function () {
    $real = $this->postJson('/api/v1/auth/lupa-sandi', ['email' => 'rizky@kantor.test'])->assertOk();
    $ghost = $this->postJson('/api/v1/auth/lupa-sandi', ['email' => 'hantu@kantor.test'])->assertOk();

    expect(array_keys($real->json()))->toBe(array_keys($ghost->json()))
        ->and($real->json('message'))->toBe($ghost->json('message'))
        ->and(PasswordResetRequest::query()->count())->toBe(1);

    b1ResetStatus($ghost->json('request_token'))->assertJsonPath('status', 'pending');

    $this->travel(25)->hours();
    b1ResetStatus($ghost->json('request_token'))->assertJsonPath('status', 'expired');
    b1ResetStatus($real->json('request_token'))->assertJsonPath('status', 'expired');
});

test('forgot password: forged, tampered or missing tokens read expired or are rejected', function () {
    $request = b1RequestReset();
    [$random, $time, $signature] = explode('.', $request);

    b1ResetStatus('sembarang')->assertOk()->assertJsonPath('status', 'expired');
    // Claiming an older request time does not help: the HMAC no longer matches.
    b1ResetStatus($random.'.'.((int) $time - 90_000).'.'.$signature)->assertOk()->assertJsonPath('status', 'expired');
    // The random part alone (as stored by the server) is not a valid token.
    b1ResetStatus($random)->assertOk()->assertJsonPath('status', 'expired');

    $this->getJson('/api/v1/auth/lupa-sandi/status')->assertUnprocessable()->assertJsonValidationErrors('request_token');
    // The query string works too.
    $this->getJson('/api/v1/auth/lupa-sandi/status?request_token='.urlencode($request))->assertOk()->assertJsonPath('status', 'pending');
});

test('forgot password: the token carries its time under an HMAC', function () {
    $wrapped = ApiPasswordResetToken::wrap('abc123', CarbonImmutable::parse('2026-10-13 09:00:00'));

    expect(ApiPasswordResetToken::unwrap($wrapped))->toMatchArray(['token' => 'abc123'])
        ->and(ApiPasswordResetToken::unwrap($wrapped.'x'))->toBeNull()
        ->and(ApiPasswordResetToken::unwrap('a.b'))->toBeNull();
});

test('forgot password: the new password follows the password policy and needs a valid setup token', function () {
    $request = b1RequestReset();
    b1Decide($this->user, true);
    $setup = b1ResetStatus($request)->json('setup_token');

    $device = ['platform' => 'android', 'device_id_hash' => B1_HASH_A];

    $this->postJson('/api/v1/auth/lupa-sandi/selesai', ['setup_token' => $setup, 'password' => 'SandiBaru12345', 'password_confirmation' => 'beda', 'device' => $device])
        ->assertUnprocessable()->assertJsonValidationErrors('password');

    config(['auth.employee_default_password' => 'SandiBawaan123']);
    $this->postJson('/api/v1/auth/lupa-sandi/selesai', ['setup_token' => $setup, 'password' => 'SandiBawaan123', 'password_confirmation' => 'SandiBawaan123', 'device' => $device])
        ->assertUnprocessable()->assertJsonValidationErrors('password');

    $this->postJson('/api/v1/auth/lupa-sandi/selesai', ['setup_token' => 'salah', 'password' => 'SandiBaru12345', 'password_confirmation' => 'SandiBaru12345', 'device' => $device])
        ->assertUnprocessable()->assertJsonPath('code', 'setup_token_invalid');

    // Nothing changed yet.
    expect(Hash::check('password', $this->user->refresh()->password))->toBeTrue();
});

test('forgot password: after the 30-minute window the setup token is dead', function () {
    $request = b1RequestReset();
    b1Decide($this->user, true);
    $setup = b1ResetStatus($request)->json('setup_token');

    $this->travel(31)->minutes();

    $this->postJson('/api/v1/auth/lupa-sandi/selesai', [
        'setup_token' => $setup,
        'password' => 'SandiBaru12345',
        'password_confirmation' => 'SandiBaru12345',
        'device' => ['platform' => 'android', 'device_id_hash' => B1_HASH_A],
    ])->assertUnprocessable()->assertJsonPath('code', 'setup_token_invalid');
    b1ResetStatus($request)->assertJsonPath('status', 'expired');
});

test('forgot password: an account with TOTP still answers with a challenge', function () {
    b1EnableTotp($this->user);
    $request = b1RequestReset();
    b1Decide($this->user, true);
    $setup = b1ResetStatus($request)->json('setup_token');

    $response = $this->postJson('/api/v1/auth/lupa-sandi/selesai', [
        'setup_token' => $setup,
        'password' => 'SandiBaru12345',
        'password_confirmation' => 'SandiBaru12345',
        'device' => ['platform' => 'android', 'device_id_hash' => B1_HASH_A],
    ])->assertOk()->assertJsonPath('two_factor_required', true);

    expect($response->json())->not->toHaveKey('token');

    $this->postJson('/api/v1/auth/dua-faktor', ['challenge_token' => $response->json('challenge_token'), 'code' => b1Otp()])
        ->assertOk()->assertJsonStructure(['token']);
});

test('forgot password: the request endpoint is throttled like the web form', function () {
    foreach (range(1, 5) as $ignored) {
        $this->postJson('/api/v1/auth/lupa-sandi', ['email' => 'rizky@kantor.test'])->assertOk();
    }

    $this->postJson('/api/v1/auth/lupa-sandi', ['email' => 'rizky@kantor.test'])
        ->assertStatus(429)->assertJsonPath('code', 'throttled');
});

test('forgot password: a malformed address is a 422', function () {
    $this->postJson('/api/v1/auth/lupa-sandi', ['email' => 'bukan-email'])->assertUnprocessable()->assertJsonValidationErrors('email');
});

test('the web password change still revokes every API token', function () {
    // Guard: ChangeOwnPassword without a kept device (web) still revokes every token.
    $token = b1Login()->json('token');
    app(ChangeOwnPassword::class)->handle($this->user, 'SandiWebBaru123');

    b1As($token)->getJson('/api/v1/auth/saya')->assertUnauthorized();
});

// ------------------------------------------------------------- /konfigurasi

test('konfigurasi is public and reads config/api_app.php', function () {
    config([
        'api_app.min_version' => '1.2.0',
        'api_app.latest_version' => '1.4.0',
        'api_app.maintenance.active' => false,
        'api_app.maintenance.message' => 'Pemeliharaan malam ini.',
    ]);

    $this->travelTo('2026-10-13 09:00:00');

    $this->getJson('/api/v1/konfigurasi')->assertOk()->assertExactJson([
        'min_app_version' => '1.2.0',
        'latest_app_version' => '1.4.0',
        'maintenance' => ['active' => false, 'message' => 'Pemeliharaan malam ini.'],
        'server_time' => now()->toIso8601String(),
    ]);
});

test('konfigurasi defaults to 1.0.0 without maintenance', function () {
    $this->getJson('/api/v1/konfigurasi')->assertOk()
        ->assertJsonPath('min_app_version', '1.0.0')
        ->assertJsonPath('latest_app_version', '1.0.0')
        ->assertJsonPath('maintenance.active', false);
});

test('maintenance mode answers 503 everywhere except konfigurasi', function () {
    $token = b1Login()->json('token');
    config(['api_app.maintenance.active' => true, 'api_app.maintenance.message' => 'Sedang pemeliharaan.']);

    b1Login()->assertStatus(503)->assertJsonPath('code', 'maintenance')->assertJsonPath('message', 'Sedang pemeliharaan.');
    b1As($token)->getJson('/api/v1/auth/saya')->assertStatus(503)->assertJsonPath('code', 'maintenance');
    $this->postJson('/api/v1/auth/lupa-sandi', ['email' => 'a@b.test'])->assertStatus(503);

    $this->getJson('/api/v1/konfigurasi')->assertOk()
        ->assertJsonPath('maintenance.active', true)
        ->assertJsonPath('maintenance.message', 'Sedang pemeliharaan.');
});

test('an app below the minimum version gets 426, others pass', function () {
    config(['api_app.min_version' => '1.2.0']);

    $this->withHeader('X-App-Version', '1.1.9')->getJson('/api/v1/auth/saya')
        ->assertStatus(426)->assertJsonPath('code', 'update_required')->assertJsonPath('min_app_version', '1.2.0');
    $this->withHeader('X-App-Version', '1.1.9')->postJson('/api/v1/auth/login', [])->assertStatus(426);

    // Exactly the minimum, higher, a pre-release suffix, no header, garbage: all pass the gate (401/422 are the route's own answers).
    $this->withHeader('X-App-Version', '1.2.0')->getJson('/api/v1/auth/saya')->assertUnauthorized();
    $this->withHeader('X-App-Version', '2.0.0')->getJson('/api/v1/auth/saya')->assertUnauthorized();
    $this->getJson('/api/v1/auth/saya')->assertUnauthorized();
    $this->withHeader('X-App-Version', 'dev-build')->getJson('/api/v1/auth/saya')->assertUnauthorized();

    // konfigurasi is always reachable so the app can read the store link / message.
    $this->withHeader('X-App-Version', '0.1.0')->getJson('/api/v1/konfigurasi')->assertOk();
});
