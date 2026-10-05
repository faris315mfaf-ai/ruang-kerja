<?php

use App\Domain\Auth\Actions\AuthenticateSuperAdmin;
use App\Domain\Auth\Enums\LoginMethod;
use App\Domain\Organization\Enums\Role;
use App\Http\Middleware\EnsureActiveEmployee;
use App\Models\AuditLog;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Testing\TestResponse;
use Inertia\Testing\AssertableInertia as Assert;

/**
 * Email + password is the emergency door for Super Admins only (PRD M1).
 */
beforeEach(function () {
    $this->seed(RoleSeeder::class);
});

function passwordLogin(string $email, string $password = 'password'): TestResponse
{
    return test()->from(route('login'))->post(route('login.store'), [
        'email' => $email,
        'password' => $password,
    ]);
}

it('renders the login screen', function () {
    $this->get(route('login'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('auth/login')
            ->has('google')
            ->where('google.rejectedEmail', null),
        );
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
    expect(session(LoginMethod::SESSION_KEY))->toBe('password')
        ->and($admin->refresh()->last_login_at?->toIso8601String())->toBe(now()->toIso8601String());

    $this->get('/dashboard')->assertOk();
});

it('signs in a Super Admin without TOTP but forces the setup page', function () {
    $admin = User::factory()->withRole(Role::SuperAdmin)->create();

    passwordLogin($admin->email)->assertRedirect('/dashboard');

    $this->assertAuthenticatedAs($admin);

    $this->get('/dashboard')->assertRedirect(route('security.edit'));
});

it('tells other employees with a valid password to use Google', function (Role $role) {
    $user = User::factory()->withRole($role)->create();

    passwordLogin($user->email)
        ->assertRedirect(route('login'))
        ->assertSessionHasErrors(['email' => AuthenticateSuperAdmin::USE_GOOGLE]);

    $this->assertGuest();
})->with([Role::Direksi, Role::Hr, Role::KepalaDivisi, Role::Anggota]);

it('gives the same generic message for a wrong password, unknown email or Google-only account', function (string $case) {
    $admin = User::factory()->withRole(Role::SuperAdmin)->create();
    $googleOnly = User::factory()->withRole(Role::Anggota)->create(['password' => null]);

    [$email, $password] = match ($case) {
        'wrong password' => [$admin->email, 'wrong-password'],
        'unknown email' => ['tidak-ada@example.com', 'password'],
        'no password' => [$googleOnly->email, 'password'],
    };

    passwordLogin($email, $password)
        ->assertSessionHasErrors(['email' => AuthenticateSuperAdmin::INVALID_CREDENTIALS]);

    $this->assertGuest();
})->with(['wrong password', 'unknown email', 'no password']);

it('rejects an inactive Super Admin at login', function (string $state) {
    $admin = User::factory()->{$state}()->withRole(Role::SuperAdmin)->create();

    passwordLogin($admin->email)
        ->assertSessionHasErrors(['email' => EnsureActiveEmployee::MESSAGE]);

    $this->assertGuest();
})->with(['inactive', 'resigned']);

it('rejects an inactive Super Admin before the two-factor challenge', function () {
    $admin = User::factory()->inactive()->withTwoFactor()->withRole(Role::SuperAdmin)->create();

    passwordLogin($admin->email)
        ->assertSessionHasErrors(['email' => EnsureActiveEmployee::MESSAGE])
        ->assertSessionMissing('login.id');
});

it('matches the email case-insensitively', function () {
    $admin = User::factory()->withRole(Role::SuperAdmin)->create(['email' => 'admin@kantor.test']);

    passwordLogin('ADMIN@Kantor.test')->assertRedirect('/dashboard');

    $this->assertAuthenticatedAs($admin);
});

it('audits Super Admin sign-in successes and failures', function () {
    $admin = User::factory()->withRole(Role::SuperAdmin)->create();

    passwordLogin($admin->email, 'wrong-password');
    passwordLogin($admin->email);

    $failed = AuditLog::query()->where('action', 'user.login_failed')->sole();
    expect($failed->user_id)->toBeNull()
        ->and($failed->auditable_id)->toBe($admin->id)
        ->and($failed->new_values)->toBe(['method' => 'password', 'reason' => 'invalid_credentials'])
        ->and($failed->ip_address)->toBe('127.0.0.1');

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

it('does not audit sign-in attempts of other employees', function () {
    $user = User::factory()->withRole(Role::Anggota)->create();

    passwordLogin($user->email);
    passwordLogin($user->email, 'wrong-password');

    expect(AuditLog::query()->whereIn('action', ['user.login_failed', 'user.logged_in'])->count())->toBe(0);
});

it('lets users log out', function () {
    $user = User::factory()->create();

    $this->actingAs($user)->post(route('logout'))->assertRedirect(route('home'));

    $this->assertGuest();
});

it('is rate limited per email and IP', function () {
    $admin = User::factory()->withRole(Role::SuperAdmin)->create();

    RateLimiter::increment(md5('login'.implode('|', [$admin->email, '127.0.0.1'])), amount: 5);

    passwordLogin($admin->email, 'wrong-password')->assertTooManyRequests();
});

it('is rate limited to 10 attempts per minute per IP', function () {
    RateLimiter::increment(md5('login'.'ip|127.0.0.1'), amount: 10);

    passwordLogin('siapa-saja@example.com', 'wrong-password')->assertTooManyRequests();
});
