<?php

use App\Domain\Auth\Enums\LoginMethod;
use App\Domain\Organization\Enums\Role;
use App\Models\AuditLog;
use App\Models\User;
use Database\Seeders\DemoUserSeeder;
use Inertia\Testing\AssertableInertia as Assert;

/**
 * Demo login reads the environment at request time. Outside APP_ENV=testing the
 * CSRF middleware is active, so requests carry `Sec-Fetch-Site: same-origin`
 * exactly like a browser would.
 */
function useDemoEnvironment(string $environment, bool $enabled): void
{
    app()->instance('env', $environment);
    config(['app.demo_login' => $enabled]);
}

it('lists the demo accounts on the login page when enabled locally', function () {
    useDemoEnvironment('local', true);

    $this->get(route('login'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('auth/login')
            ->has('demoAccounts', 5)
            ->where('demoAccounts.0', [
                'email' => 'admin@demo.test',
                'name' => 'Admin Sistem',
                'role_label' => 'Super Admin',
            ])
            ->where('demoAccounts.3.email', 'kadiv@demo.test')
            ->where('demoAccounts.3.role_label', 'Kepala Divisi'),
        );
});

it('logs in as a demo account and redirects to the dashboard', function () {
    $this->seed(DemoUserSeeder::class);
    useDemoEnvironment('local', true);

    $response = $this->withHeader('Sec-Fetch-Site', 'same-origin')
        ->post(route('login.demo'), ['email' => 'kadiv@demo.test']);

    $kadiv = User::query()->where('email', 'kadiv@demo.test')->firstOrFail();

    $response->assertRedirect('/dashboard');
    $this->assertAuthenticatedAs($kadiv);
    expect($kadiv->hasRole(Role::KepalaDivisi->value))->toBeTrue();
});

it('returns 404 when the demo flag is disabled', function () {
    $this->seed(DemoUserSeeder::class);
    useDemoEnvironment('local', false);

    $this->get(route('login'))
        ->assertInertia(fn (Assert $page) => $page->where('demoAccounts', []));

    $this->withHeader('Sec-Fetch-Site', 'same-origin')
        ->post(route('login.demo'), ['email' => 'kadiv@demo.test'])
        ->assertNotFound();

    $this->assertGuest();
});

it('returns 404 outside the local environment even when the flag is on', function (string $environment) {
    $this->seed(DemoUserSeeder::class);
    useDemoEnvironment($environment, true);

    $this->get(route('login'))
        ->assertInertia(fn (Assert $page) => $page->where('demoAccounts', []));

    $this->withHeader('Sec-Fetch-Site', 'same-origin')
        ->post(route('login.demo'), ['email' => 'kadiv@demo.test'])
        ->assertNotFound();

    $this->assertGuest();
})->with(['production', 'staging', 'testing']);

it('rejects an email outside the demo list', function () {
    User::factory()->create(['email' => 'someone@example.com']);
    useDemoEnvironment('local', true);

    $this->withHeader('Sec-Fetch-Site', 'same-origin')
        ->from(route('login'))
        ->post(route('login.demo'), ['email' => 'someone@example.com'])
        ->assertRedirect(route('login'))
        ->assertSessionHasErrors('email');

    $this->assertGuest();
});

it('reports a validation error when demo accounts have not been seeded', function () {
    useDemoEnvironment('local', true);

    $this->withHeader('Sec-Fetch-Site', 'same-origin')
        ->from(route('login'))
        ->post(route('login.demo'), ['email' => 'kadiv@demo.test'])
        ->assertSessionHasErrors('email');

    $this->assertGuest();
});

it('is only available to guests', function () {
    $this->seed(DemoUserSeeder::class);
    useDemoEnvironment('local', true);

    $user = User::factory()->create();

    $this->actingAs($user)
        ->withHeader('Sec-Fetch-Site', 'same-origin')
        ->post(route('login.demo'), ['email' => 'admin@demo.test'])
        ->assertRedirect();

    $this->assertAuthenticatedAs($user);
});

it('stamps last_login_at and records the demo login method', function () {
    $this->seed(DemoUserSeeder::class);
    useDemoEnvironment('local', true);
    $this->travelTo(now()->setDateTime(2026, 10, 5, 3, 15));

    $this->withHeader('Sec-Fetch-Site', 'same-origin')
        ->post(route('login.demo'), ['email' => 'anggota@demo.test'])
        ->assertRedirect('/dashboard');

    $anggota = User::query()->where('email', 'anggota@demo.test')->firstOrFail();
    expect($anggota->last_login_at?->toIso8601String())->toBe(now()->toIso8601String())
        ->and(session(LoginMethod::SESSION_KEY))->toBe('demo');
});

it('lets the demo Super Admin in without TOTP setup and audits the sign-in', function () {
    $this->seed(DemoUserSeeder::class);
    useDemoEnvironment('local', true);

    $this->withHeader('Sec-Fetch-Site', 'same-origin')
        ->post(route('login.demo'), ['email' => 'admin@demo.test'])
        ->assertRedirect('/dashboard');

    $this->withHeader('Sec-Fetch-Site', 'same-origin')->get('/dashboard')->assertOk();

    $log = AuditLog::query()->where('action', 'user.logged_in')->sole();
    expect($log->new_values)->toBe(['method' => 'demo']);
});
