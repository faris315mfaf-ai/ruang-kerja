<?php

use App\Domain\Auth\Actions\AuthenticateEmployee;
use App\Domain\Auth\Enums\LoginMethod;
use App\Domain\Organization\Enums\Role;
use App\Models\AuditLog;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Timebox;
use Illuminate\Testing\TestResponse;
use Inertia\Testing\AssertableInertia as Assert;

/**
 * Email + password for every active employee (owner decision 6 Oct 2026);
 * Super Admins additionally need TOTP. Google sign-in is on hold.
 */
beforeEach(function () {
    $this->seed(RoleSeeder::class);
});

function passwordLogin(string $email, string $password = 'password', array $extra = []): TestResponse
{
    return test()->from(route('login'))->post(route('login.store'), [
        'email' => $email,
        'password' => $password,
        ...$extra,
    ]);
}

it('renders the login screen with the password form and no Google button', function () {
    $this->get(route('login'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('auth/login')
            ->missing('google')
            ->missing('canResetPassword')
            ->has('demoAccounts'),
        );
});

it('signs in every non-Super-Admin role with email and password, without 2FA', function (Role $role) {
    $this->travelTo(now()->setDateTime(2026, 10, 6, 1, 0));
    $user = User::factory()->withRole($role)->create();

    passwordLogin($user->email)->assertRedirect('/dashboard');

    $this->assertAuthenticatedAs($user);
    expect(session(LoginMethod::SESSION_KEY))->toBe('password')
        ->and($user->refresh()->last_login_at?->toIso8601String())->toBe(now()->toIso8601String());

    $this->get('/dashboard')->assertOk();
})->with([Role::Direksi, Role::Hr, Role::KepalaDivisi, Role::Anggota]);

it('signs in an employee with several roles (Kepala Divisi HR)', function () {
    $user = User::factory()->withRole(Role::KepalaDivisi, Role::Hr)->create();

    passwordLogin($user->email)->assertRedirect('/dashboard');

    $this->assertAuthenticatedAs($user);
});

it('lets a Super Admin with confirmed TOTP through to the two-factor challenge', function () {
    $admin = User::factory()->withTwoFactor()->withRole(Role::SuperAdmin)->create();

    passwordLogin($admin->email)
        ->assertRedirect(route('two-factor.login'))
        ->assertSessionHas('login.id', $admin->id);

    $this->assertGuest();
});

it('completes the Super Admin sign-in with a recovery code', function () {
    $this->travelTo(now()->setDateTime(2026, 10, 5, 2, 0));
    $admin = User::factory()->withTwoFactor()->withRole(Role::SuperAdmin)->create();

    passwordLogin($admin->email);

    $this->post(route('two-factor.login.store'), ['recovery_code' => 'recovery-code-1'])
        ->assertRedirect('/dashboard');

    $this->assertAuthenticatedAs($admin);
    expect(session(LoginMethod::SESSION_KEY))->toBe('password');

    $this->get('/dashboard')->assertOk();
});

it('signs in a Super Admin without TOTP but forces the setup page', function () {
    $admin = User::factory()->withRole(Role::SuperAdmin)->create();

    passwordLogin($admin->email)->assertRedirect('/dashboard');

    $this->assertAuthenticatedAs($admin);

    $this->get('/dashboard')->assertRedirect(route('security.edit'));
});

it('does not force TOTP on other roles after a password sign-in', function (Role $role) {
    $user = User::factory()->withRole($role)->create();

    passwordLogin($user->email);

    $this->get('/dashboard')->assertOk();
})->with([Role::Direksi, Role::Hr, Role::KepalaDivisi, Role::Anggota]);

it('gives the same generic message for every failure', function (string $case) {
    $user = User::factory()->withRole(Role::Anggota)->create(['email' => 'rizky@kantor.test']);
    User::factory()->withRole(Role::Anggota)->create(['email' => 'tanpa-sandi@kantor.test', 'password' => null]);
    User::factory()->inactive()->withRole(Role::Anggota)->create(['email' => 'nonaktif@kantor.test']);
    User::factory()->resigned()->withRole(Role::Hr)->create(['email' => 'keluar@kantor.test']);

    [$email, $password] = match ($case) {
        'wrong password' => [$user->email, 'salah-sekali'],
        'unknown email' => ['tidak-ada@kantor.test', 'password'],
        'no password set' => ['tanpa-sandi@kantor.test', 'password'],
        'inactive, correct password' => ['nonaktif@kantor.test', 'password'],
        'resigned, correct password' => ['keluar@kantor.test', 'password'],
    };

    passwordLogin($email, $password)
        ->assertRedirect(route('login'))
        ->assertSessionHasErrors(['email' => AuthenticateEmployee::INVALID_CREDENTIALS]);

    $this->assertGuest();
})->with(['wrong password', 'unknown email', 'no password set', 'inactive, correct password', 'resigned, correct password']);

it('mentions HR and "Lupa kata sandi" in the generic message (password not set yet)', function () {
    expect(AuthenticateEmployee::INVALID_CREDENTIALS)
        ->toContain('Hubungi HR')
        ->toContain('Lupa kata sandi');
});

it('runs every attempt inside the same 200 ms timebox', function (string $email) {
    User::factory()->withRole(Role::Anggota)->create(['email' => 'ada@kantor.test']);
    User::factory()->withRole(Role::Anggota)->create(['email' => 'kosong@kantor.test', 'password' => null]);

    $calls = [];
    $this->app->bind(Timebox::class, function () use (&$calls) {
        return new class($calls) extends Timebox
        {
            public function __construct(private array &$calls) {}

            public function call(callable $callback, int $microseconds)
            {
                $this->calls[] = $microseconds;

                return $callback($this);
            }
        };
    });

    passwordLogin($email, 'salah');

    expect($calls)->toBe([200_000]);
})->with(['ada@kantor.test', 'kosong@kantor.test', 'tidak-ada@kantor.test']);

it('rejects an inactive Super Admin before the two-factor challenge', function () {
    $admin = User::factory()->inactive()->withTwoFactor()->withRole(Role::SuperAdmin)->create();

    passwordLogin($admin->email)
        ->assertSessionHasErrors(['email' => AuthenticateEmployee::INVALID_CREDENTIALS])
        ->assertSessionMissing('login.id');
});

it('matches the email case-insensitively', function () {
    $user = User::factory()->withRole(Role::Anggota)->create(['email' => 'rizky@kantor.test']);

    passwordLogin('  RIZKY@Kantor.test ')->assertRedirect('/dashboard');

    $this->assertAuthenticatedAs($user);
});

it('remembers the device when asked', function () {
    $user = User::factory()->withRole(Role::Anggota)->create();

    $response = passwordLogin($user->email, 'password', ['remember' => 'on']);

    $response->assertRedirect('/dashboard');
    expect(collect($response->headers->getCookies())->contains(
        fn ($cookie) => str_starts_with($cookie->getName(), 'remember_web_'),
    ))->toBeTrue();
});

it('audits failed sign-ins of known accounts with the reason, never the password', function (string $case, string $reason) {
    $user = match ($case) {
        'no password' => User::factory()->withRole(Role::Anggota)->create(['password' => null]),
        'inactive' => User::factory()->inactive()->withRole(Role::Anggota)->create(),
        default => User::factory()->withRole(Role::Anggota)->create(),
    };

    passwordLogin($user->email, $case === 'inactive' ? 'password' : 'kata-sandi-rahasia');

    $failed = AuditLog::query()->where('action', 'user.login_failed')->sole();
    expect($failed->user_id)->toBeNull()
        ->and($failed->auditable_id)->toBe($user->id)
        ->and($failed->new_values)->toBe(['method' => 'password', 'reason' => $reason])
        ->and(json_encode([$failed->old_values, $failed->new_values]))->not->toContain('kata-sandi-rahasia');
})->with([
    ['wrong password', 'invalid_credentials'],
    ['no password', 'no_password'],
    ['inactive', 'inactive'],
]);

it('does not audit attempts for unknown addresses', function () {
    passwordLogin('tidak-ada@kantor.test', 'salah');

    expect(AuditLog::query()->where('action', 'user.login_failed')->count())->toBe(0);
});

it('audits Super Admin sign-ins (other roles: failures only)', function () {
    $admin = User::factory()->withRole(Role::SuperAdmin)->create();
    $member = User::factory()->withRole(Role::Anggota)->create();

    passwordLogin($admin->email);
    auth()->logout();
    passwordLogin($member->email);

    $success = AuditLog::query()->where('action', 'user.logged_in')->sole();
    expect($success->user_id)->toBe($admin->id)
        ->and($success->new_values)->toBe(['method' => 'password']);
});

it('audits a wrong two-factor code for a Super Admin', function () {
    $admin = User::factory()->withTwoFactor()->withRole(Role::SuperAdmin)->create();

    passwordLogin($admin->email);
    $this->post(route('two-factor.login.store'), ['recovery_code' => 'salah']);

    $this->assertGuest();
    expect(AuditLog::query()->where('action', 'user.login_failed')->sole()->new_values)
        ->toBe(['method' => 'password', 'reason' => 'two_factor_invalid']);
});

it('lets users log out', function () {
    $user = User::factory()->create();

    $this->actingAs($user)->post(route('logout'))->assertRedirect(route('home'));

    $this->assertGuest();
});

it('is rate limited per email and IP', function () {
    $user = User::factory()->withRole(Role::Anggota)->create();

    RateLimiter::increment(md5('login'.implode('|', [$user->email, '127.0.0.1'])), amount: 5);

    passwordLogin($user->email, 'password')->assertTooManyRequests();
    $this->assertGuest();
});

it('is rate limited to 10 attempts per minute per IP', function () {
    RateLimiter::increment(md5('login'.'ip|127.0.0.1'), amount: 10);

    passwordLogin('siapa-saja@example.com', 'wrong-password')->assertTooManyRequests();
});

it('counts every failed attempt towards the limit, known address or not', function () {
    $user = User::factory()->withRole(Role::Anggota)->create();

    foreach (range(1, 5) as $attempt) {
        passwordLogin($user->email, "salah-{$attempt}")->assertSessionHasErrors('email');
    }

    passwordLogin($user->email, 'password')->assertTooManyRequests();
    $this->assertGuest();
});
