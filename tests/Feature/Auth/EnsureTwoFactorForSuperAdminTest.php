<?php

use App\Domain\Auth\Enums\LoginMethod;
use App\Domain\Organization\Enums\Role;
use App\Http\Middleware\EnsureTwoFactorForSuperAdmin;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

beforeEach(function () {
    $this->seed(RoleSeeder::class);
});

function signedInWith(User $user, ?LoginMethod $method): TestCase
{
    return test()->actingAs($user)->withSession(array_filter([
        LoginMethod::SESSION_KEY => $method?->value,
        'auth.password_confirmed_at' => time(),
    ]));
}

it('redirects a password-signed-in Super Admin without TOTP to the security page', function (LoginMethod $method) {
    $admin = User::factory()->withRole(Role::SuperAdmin)->create();

    signedInWith($admin, $method)->get('/dashboard')
        ->assertRedirect(route('security.edit'));

    signedInWith($admin, $method)->get(route('profile.edit'))
        ->assertRedirect(route('security.edit'));
})->with([LoginMethod::Password, LoginMethod::Remember]);

it('answers 403 to JSON requests until TOTP is set up', function () {
    $admin = User::factory()->withRole(Role::SuperAdmin)->create();

    signedInWith($admin, LoginMethod::Password)->getJson('/dashboard')
        ->assertForbidden()
        ->assertJson(['message' => EnsureTwoFactorForSuperAdmin::MESSAGE]);
});

it('keeps the setup flow, theme and logout reachable', function () {
    $admin = User::factory()->withRole(Role::SuperAdmin)->create();

    signedInWith($admin, LoginMethod::Password)->get(route('security.edit'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('settings/security')
            ->where('twoFactorRequired', true),
        );

    signedInWith($admin, LoginMethod::Password)->post(route('two-factor.enable'))
        ->assertSessionHasNoErrors();
    expect($admin->refresh()->two_factor_secret)->not->toBeNull();

    signedInWith($admin, LoginMethod::Password)->patchJson(route('theme.update'), ['theme' => 'dark'])
        ->assertNoContent();

    signedInWith($admin, LoginMethod::Password)->post(route('logout'))->assertRedirect(route('home'));
    $this->assertGuest();
});

it('lets the Super Admin in once TOTP is confirmed', function () {
    $admin = User::factory()->withTwoFactor()->withRole(Role::SuperAdmin)->create();

    signedInWith($admin, LoginMethod::Password)->get('/dashboard')->assertOk();
});

it('still requires setup while TOTP is enabled but not confirmed', function () {
    $admin = User::factory()->withRole(Role::SuperAdmin)->create([
        'two_factor_secret' => encrypt('secret'),
        'two_factor_confirmed_at' => null,
    ]);

    signedInWith($admin, LoginMethod::Password)->get('/dashboard')
        ->assertRedirect(route('security.edit'));
});

it('exempts Google sign-ins and sessions without a recorded login', function (?LoginMethod $method) {
    $admin = User::factory()->withRole(Role::SuperAdmin)->create();

    signedInWith($admin, $method)->get('/dashboard')->assertOk();
})->with([
    'google' => LoginMethod::Google,
    'no login recorded (actingAs)' => null,
]);

it('exempts the demo login only while demo login is enabled locally', function (string $environment, bool $enabled, bool $exempt) {
    app()->instance('env', $environment);
    config(['app.demo_login' => $enabled]);
    $admin = User::factory()->withRole(Role::SuperAdmin)->create();

    $response = signedInWith($admin, LoginMethod::Demo)
        ->withHeader('Sec-Fetch-Site', 'same-origin')
        ->get('/dashboard');

    $exempt ? $response->assertOk() : $response->assertRedirect(route('security.edit'));
})->with([
    'local + enabled' => ['local', true, true],
    'local + disabled' => ['local', false, false],
    'production + enabled' => ['production', true, false],
]);

it('never applies to other roles', function (Role $role) {
    $user = User::factory()->withRole($role)->create();

    signedInWith($user, LoginMethod::Password)->get('/dashboard')->assertOk();
})->with([Role::Direksi, Role::Hr, Role::KepalaDivisi, Role::Anggota]);
