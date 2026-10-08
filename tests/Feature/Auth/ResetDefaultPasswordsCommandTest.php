<?php

use App\Domain\Auth\Actions\ResetPasswordsToDefault;
use App\Domain\Auth\Enums\PasswordResetStatus;
use App\Domain\Auth\Notifications\PasswordSetByHrNotification;
use App\Domain\Organization\Enums\Role;
use App\Domain\Organization\Enums\UserStatus;
use App\Models\AuditLog;
use App\Models\Company;
use App\Models\PasswordResetRequest;
use App\Models\User;
use Carbon\CarbonImmutable;
use Database\Seeders\RoleSeeder;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Notification;

/**
 * `php artisan ruangkerja:reset-default-passwords` (owner decision 7 Oct 2026).
 * The value below is a test placeholder.
 */
const SANDI_BAWAAN_PERINTAH = 'ContohSandi123';

beforeEach(function () {
    $this->seed(RoleSeeder::class);
    config(['auth.employee_default_password' => SANDI_BAWAAN_PERINTAH]);

    $this->company = Company::factory()->create();
    $this->active = User::factory()->forCompany($this->company)->withRole(Role::Anggota)->create(['email' => 'aktif@kantor.test']);
    $this->noPassword = User::factory()->forCompany($this->company)->withRole(Role::KepalaDivisi)->create(['email' => 'tanpa-sandi@kantor.test', 'password' => null]);
    $this->inactive = User::factory()->forCompany($this->company)->withRole(Role::Anggota)->create(['email' => 'nonaktif@kantor.test', 'status' => UserStatus::Inactive]);
    $this->resigned = User::factory()->forCompany($this->company)->withRole(Role::Anggota)->create(['email' => 'keluar@kantor.test', 'status' => UserStatus::Resigned]);
    $this->admin = User::factory()->forCompany($this->company)->withRole(Role::SuperAdmin)->create(['email' => 'admin@kantor.test']);
});

function hasDefaultPassword(User $user): bool
{
    $user->refresh();

    return $user->password !== null && Hash::check(SANDI_BAWAAN_PERINTAH, $user->password) && $user->password_change_required;
}

it('resets every active and inactive employee, skipping Super Admins and resigned accounts', function () {
    $this->artisan('ruangkerja:reset-default-passwords', ['--force' => true])
        ->expectsOutputToContain('3 akun karyawan direset ke sandi bawaan')
        ->assertSuccessful();

    expect(hasDefaultPassword($this->active))->toBeTrue()
        ->and(hasDefaultPassword($this->noPassword))->toBeTrue()
        ->and(hasDefaultPassword($this->inactive))->toBeTrue()
        ->and(Hash::check('password', (string) $this->resigned->refresh()->password))->toBeTrue()
        ->and($this->resigned->password_change_required)->toBeFalse()
        ->and(Hash::check('password', (string) $this->admin->refresh()->password))->toBeTrue()
        ->and($this->admin->password_change_required)->toBeFalse();
});

it('skips direksi and hr accounts: their password is Super Admin only (R-06)', function (Role $role) {
    $guarded = User::factory()->forCompany($this->company)->withRole($role)->create(['email' => 'dijaga@kantor.test']);

    $this->artisan('ruangkerja:reset-default-passwords', ['--force' => true])
        ->expectsOutputToContain('3 akun karyawan direset ke sandi bawaan')
        ->assertSuccessful();

    expect(Hash::check('password', (string) $guarded->refresh()->password))->toBeTrue()
        ->and($guarded->password_change_required)->toBeFalse()
        ->and(AuditLog::query()->where('auditable_id', $guarded->id)->where('action', 'user.password_reset_to_default')->doesntExist())->toBeTrue();
})->with([Role::Direksi, Role::Hr]);

it('audits one row per account without the value', function () {
    $this->artisan('ruangkerja:reset-default-passwords', ['--force' => true])->assertSuccessful();

    $rows = AuditLog::query()->where('action', 'user.password_reset_to_default')->get();

    expect($rows->pluck('auditable_id')->sort()->values()->all())
        ->toBe(collect([$this->active->id, $this->noPassword->id, $this->inactive->id])->sort()->values()->all())
        ->and($rows->firstWhere('auditable_id', $this->noPassword->id)?->new_values)->toBe(['was_empty' => true, 'must_change' => true])
        ->and($rows->firstWhere('auditable_id', $this->active->id)?->new_values)->toBe(['was_empty' => false, 'must_change' => true])
        ->and(AuditLog::query()->get()->toJson())->not->toContain(SANDI_BAWAAN_PERINTAH)
        ->and(AuditLog::query()->where('action', 'user.updated')->count())->toBe(0);
});

it('ends existing sign-ins: remember token rotated, stored sessions deleted, browser signed out', function () {
    config(['session.driver' => 'database']);
    $this->active->forceFill(['remember_token' => 'token-lama'])->saveQuietly();
    DB::table('sessions')->insert([
        ['id' => 'sesi-aktif', 'user_id' => $this->active->id, 'ip_address' => null, 'user_agent' => null, 'payload' => '', 'last_activity' => time()],
        ['id' => 'sesi-admin', 'user_id' => $this->admin->id, 'ip_address' => null, 'user_agent' => null, 'payload' => '', 'last_activity' => time()],
    ]);

    $this->artisan('ruangkerja:reset-default-passwords', ['--force' => true])->assertSuccessful();

    expect($this->active->refresh()->remember_token)->not->toBe('token-lama')
        ->and(DB::table('sessions')->where('id', 'sesi-aktif')->exists())->toBeFalse()
        ->and(DB::table('sessions')->where('id', 'sesi-admin')->exists())->toBeTrue();
});

it('signs the employee\'s browser out on its next request', function () {
    $this->actingAs($this->active)->get('/dashboard')->assertOk();

    $this->artisan('ruangkerja:reset-default-passwords', ['--force' => true])->assertSuccessful();

    auth()->forgetGuards();
    $this->actingAs(User::query()->findOrFail($this->active->id))
        ->get('/dashboard')
        ->assertRedirect(route('login'));
});

it('closes open "Lupa kata sandi" requests of reset accounts', function () {
    $request = PasswordResetRequest::query()->create([
        'company_id' => $this->company->id,
        'user_id' => $this->active->id,
        'email' => $this->active->email,
        'request_token_hash' => hash('sha256', 'x'),
        'expires_at' => CarbonImmutable::now()->addDay(),
    ]);

    $this->artisan('ruangkerja:reset-default-passwords', ['--force' => true])->assertSuccessful();

    expect($request->refresh()->status)->toBe(PasswordResetStatus::Canceled);
});

it('only touches accounts without a password with --only-without-password', function () {
    $this->artisan('ruangkerja:reset-default-passwords', ['--force' => true, '--only-without-password' => true])
        ->expectsOutputToContain('1 akun karyawan tanpa kata sandi direset')
        ->assertSuccessful();

    expect(hasDefaultPassword($this->noPassword))->toBeTrue()
        ->and(Hash::check('password', (string) $this->active->refresh()->password))->toBeTrue()
        ->and($this->active->password_change_required)->toBeFalse();
});

it('lists the accounts on --dry-run without changing anything', function () {
    expect(Artisan::call('ruangkerja:reset-default-passwords', ['--dry-run' => true]))->toBe(0);
    $output = Artisan::output();

    expect($output)->toContain('Simulasi: 3 akun karyawan')
        ->toContain('aktif@kantor.test')
        ->toContain('tanpa-sandi@kantor.test')
        ->toContain('nonaktif@kantor.test')
        ->not->toContain('admin@kantor.test')
        ->not->toContain('keluar@kantor.test')
        ->not->toContain(SANDI_BAWAAN_PERINTAH);

    expect($this->noPassword->refresh()->password)->toBeNull()
        ->and(AuditLog::query()->where('action', 'user.password_reset_to_default')->exists())->toBeFalse();
});

it('asks for confirmation outside production and stops when declined', function () {
    $this->artisan('ruangkerja:reset-default-passwords')
        ->expectsConfirmation('Reset 3 akun karyawan ke sandi bawaan? Semua sesi mereka akan dikeluarkan.', 'no')
        ->assertFailed();

    expect($this->noPassword->refresh()->password)->toBeNull();

    $this->artisan('ruangkerja:reset-default-passwords')
        ->expectsConfirmation('Reset 3 akun karyawan ke sandi bawaan? Semua sesi mereka akan dikeluarkan.', 'yes')
        ->assertSuccessful();

    expect(hasDefaultPassword($this->noPassword))->toBeTrue();
});

it('requires --force in production', function () {
    $this->app['env'] = 'production';

    $this->artisan('ruangkerja:reset-default-passwords')
        ->expectsOutputToContain('wajib memakai --force')
        ->assertFailed();

    expect($this->noPassword->refresh()->password)->toBeNull();

    $this->artisan('ruangkerja:reset-default-passwords', ['--force' => true])->assertSuccessful();

    expect(hasDefaultPassword($this->noPassword))->toBeTrue();
});

it('refuses while EMPLOYEE_DEFAULT_PASSWORD is empty', function () {
    config(['auth.employee_default_password' => '']);

    $this->artisan('ruangkerja:reset-default-passwords', ['--force' => true])
        ->expectsOutputToContain('EMPLOYEE_DEFAULT_PASSWORD kosong')
        ->assertFailed();

    expect($this->noPassword->refresh()->password)->toBeNull();
    expect(fn () => app(ResetPasswordsToDefault::class)->handle())->toThrow(LogicException::class);
});

it('sends no notification by default and the existing notice with --notify', function () {
    Notification::fake();

    $this->artisan('ruangkerja:reset-default-passwords', ['--force' => true])->assertSuccessful();
    Notification::assertNothingSent();

    $this->artisan('ruangkerja:reset-default-passwords', ['--force' => true, '--notify' => true])->assertSuccessful();

    Notification::assertSentTo($this->active, PasswordSetByHrNotification::class, function (PasswordSetByHrNotification $notification) {
        $payload = $notification->payload($this->active);

        return $notification->actor === null
            && $notification->toDefault
            && $payload->title === 'Kata sandi Anda dikembalikan ke sandi bawaan'
            && ! str_contains((string) json_encode($payload->toArray($notification->type())), SANDI_BAWAAN_PERINTAH);
    });
    Notification::assertNotSentTo([$this->admin, $this->resigned], PasswordSetByHrNotification::class);
});

it('works in chunks', function () {
    User::factory()->count(ResetPasswordsToDefault::CHUNK + 1)->forCompany($this->company)->withRole(Role::Anggota)->create(['password' => null]);
    $chunks = [];

    $count = app(ResetPasswordsToDefault::class)->handle(onlyWithoutPassword: true, progress: function (int $size) use (&$chunks): void {
        $chunks[] = $size;
    });

    expect($count)->toBe(ResetPasswordsToDefault::CHUNK + 2)
        ->and($chunks)->toBe([ResetPasswordsToDefault::CHUNK, 2])
        ->and(User::query()->whereNull('password')->count())->toBe(0);
});
