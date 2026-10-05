<?php

use App\Domain\Organization\Enums\Role;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Auth\Events\OtherDeviceLogout;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Route;
use Inertia\Testing\AssertableInertia as Assert;
use Laravel\Fortify\Features;

beforeEach(function () {
    $this->seed(RoleSeeder::class);
});

it('shows password and two-factor settings to a Super Admin', function () {
    $admin = User::factory()->withRole(Role::SuperAdmin)->create();

    $this->actingAs($admin)
        ->withSession(['auth.password_confirmed_at' => time()])
        ->get(route('security.edit'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('settings/security')
            ->where('canManageTwoFactor', true)
            ->where('twoFactorEnabled', false)
            ->where('twoFactorRequired', false)
            ->missing('passkeys')
            ->missing('canManagePasskeys'),
        );
});

it('requires password confirmation', function () {
    $admin = User::factory()->withRole(Role::SuperAdmin)->create();

    $this->actingAs($admin)->get(route('security.edit'))
        ->assertRedirect(route('password.confirm'));
});

it('renders without two-factor when the feature is disabled', function () {
    config(['fortify.features' => []]);
    $admin = User::factory()->withRole(Role::SuperAdmin)->create();

    $this->actingAs($admin)
        ->withSession(['auth.password_confirmed_at' => time()])
        ->get(route('security.edit'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('canManageTwoFactor', false)
            ->missing('twoFactorEnabled')
            ->missing('requiresConfirmation'),
        );
});

it('lets a Super Admin update their password', function () {
    $admin = User::factory()->withRole(Role::SuperAdmin)->create();

    $this->actingAs($admin)
        ->from(route('security.edit'))
        ->put(route('user-password.update'), [
            'current_password' => 'password',
            'password' => 'new-password',
            'password_confirmation' => 'new-password',
        ])
        ->assertSessionHasNoErrors()
        ->assertRedirect(route('security.edit'));

    expect(Hash::check('new-password', $admin->refresh()->password))->toBeTrue();
});

it('requires the current password to update it', function () {
    $admin = User::factory()->withRole(Role::SuperAdmin)->create();

    $this->actingAs($admin)
        ->from(route('security.edit'))
        ->put(route('user-password.update'), [
            'current_password' => 'wrong-password',
            'password' => 'new-password',
            'password_confirmation' => 'new-password',
        ])
        ->assertSessionHasErrors('current_password')
        ->assertRedirect(route('security.edit'));
});

it('forbids password and two-factor routes for other roles', function (Role $role) {
    $user = User::factory()->withRole($role)->create();
    $session = ['auth.password_confirmed_at' => time()];

    $this->actingAs($user)->withSession($session)->get(route('security.edit'))->assertForbidden();
    $this->actingAs($user)->withSession($session)->put(route('user-password.update'), [
        'current_password' => 'password',
        'password' => 'new-password',
        'password_confirmation' => 'new-password',
    ])->assertForbidden();
    $this->actingAs($user)->get(route('password.confirm'))->assertForbidden();
    $this->actingAs($user)->post(route('password.confirm.store'), ['password' => 'password'])->assertForbidden();

    if (Features::canManageTwoFactorAuthentication()) {
        $this->actingAs($user)->withSession($session)->post(route('two-factor.enable'))->assertForbidden();
        $this->actingAs($user)->withSession($session)->get(route('two-factor.qr-code'))->assertForbidden();
        $this->actingAs($user)->withSession($session)->get(route('two-factor.recovery-codes'))->assertForbidden();
    }

    expect($user->refresh()->two_factor_secret)->toBeNull()
        ->and(Hash::check('password', (string) $user->password))->toBeTrue();
})->with([Role::Direksi, Role::Hr, Role::KepalaDivisi, Role::Anggota]);

it('does not register passkey routes', function () {
    expect(Route::has('passkey.login'))->toBeFalse()
        ->and(Route::has('passkey.store'))->toBeFalse()
        ->and(Route::has('well-known.passkeys'))->toBeFalse();
});

it('signs out other devices when the password changes, keeping the current session', function () {
    Event::fake([OtherDeviceLogout::class]);
    $admin = User::factory()->withRole(Role::SuperAdmin)->create();
    $oldHash = $admin->password;

    $this->actingAs($admin)
        ->withSession(['password_hash_web' => $oldHash, 'auth.password_confirmed_at' => time()])
        ->from(route('security.edit'))
        ->put(route('user-password.update'), [
            'current_password' => 'password',
            'password' => 'new-password',
            'password_confirmation' => 'new-password',
        ])
        ->assertSessionHasNoErrors();

    Event::assertDispatched(OtherDeviceLogout::class);
    $this->assertAuthenticatedAs($admin);

    // This device keeps working: its session hash was refreshed with the new password.
    $this->get(route('security.edit'))->assertOk();
    $this->assertAuthenticatedAs($admin);

    // Another device still carries the old password hash in its session.
    Auth::forgetGuards();
    $this->actingAs(User::query()->findOrFail($admin->id))
        ->withSession(['password_hash_web' => $oldHash, 'auth.password_confirmed_at' => time()])
        ->get(route('security.edit'))
        ->assertRedirect(route('login'));

    $this->assertGuest();
});

it('does not treat a session that switches accounts as a changed password', function () {
    $first = User::factory()->withRole(Role::Anggota)->create(['password' => 'kata-sandi-satu']);
    $second = User::factory()->withRole(Role::Anggota)->create(['password' => 'kata-sandi-dua']);

    $this->actingAs($first)->get('/dashboard')->assertOk();
    $this->actingAs($second)->get('/dashboard')->assertOk();
    $this->assertAuthenticatedAs($second);
});
