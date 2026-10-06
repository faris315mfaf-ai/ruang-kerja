<?php

use App\Domain\Auth\Enums\LoginMethod;
use App\Models\User;
use Database\Seeders\DemoUserSeeder;
use Inertia\Testing\AssertableInertia as Assert;

function useSwitchEnvironment(string $environment, bool $enabled): void
{
    app()->instance('env', $environment);
    config(['app.demo_login' => $enabled]);
}

beforeEach(function () {
    $this->seed(DemoUserSeeder::class);
});

it('shares the seven switcher personas with the current one marked', function () {
    useSwitchEnvironment('local', true);
    $hr = User::query()->where('email', 'hr@demo.test')->firstOrFail();

    $this->actingAs($hr)
        ->get('/menu')
        ->assertInertia(fn (Assert $page) => $page
            // Faris & Dio (final approvers of Hiring, 6 Oct 2026) close the list.
            ->has('demoSwitcher', 7)
            ->where('demoSwitcher.0.email', 'programmer@demo.test')
            ->where('demoSwitcher.0.persona', 'Staf programmer')
            ->where('demoSwitcher.1.email', 'hr@demo.test')
            ->where('demoSwitcher.1.current', true)
            ->where('demoSwitcher.2.email', 'maya.lestari@demo.test')
            ->where('demoSwitcher.3.email', 'admin@demo.test')
            ->where('demoSwitcher.4.persona', 'Direksi & manajemen')
            ->where('demoSwitcher.5.email', 'faris@demo.test')
            ->where('demoSwitcher.6.email', 'dio@demo.test')
            ->where('demoSwitcher.6.persona', 'Penyetuju akhir hiring')
            ->where('demoSwitcher.0.current', false));
});

it('does not share the switcher outside the local demo', function (string $environment, bool $enabled) {
    useSwitchEnvironment($environment, $enabled);
    $hr = User::query()->where('email', 'hr@demo.test')->firstOrFail();

    $this->actingAs($hr)
        ->get('/menu')
        ->assertInertia(fn (Assert $page) => $page->where('demoSwitcher', null));
})->with([
    'production' => ['production', true],
    'flag off' => ['local', false],
]);

it('switches to another persona with a fresh session', function () {
    useSwitchEnvironment('local', true);
    $hr = User::query()->where('email', 'hr@demo.test')->firstOrFail();
    $programmer = User::query()->where('email', 'programmer@demo.test')->firstOrFail();

    $this->actingAs($hr)->withSession(['marker' => 'previous-user']);

    $this->withHeader('Sec-Fetch-Site', 'same-origin')
        ->post(route('demo.switch'), ['email' => 'programmer@demo.test'])
        ->assertRedirect('/dashboard')
        ->assertSessionMissing('marker')
        ->assertSessionHas('auth.method', LoginMethod::Demo->value);

    $this->assertAuthenticatedAs($programmer);
});

it('rejects accounts that are not demo accounts', function () {
    useSwitchEnvironment('local', true);
    $hr = User::query()->where('email', 'hr@demo.test')->firstOrFail();
    $other = User::factory()->create(['email' => 'someone@demo.test']);

    $this->actingAs($hr)
        ->withHeader('Sec-Fetch-Site', 'same-origin')
        ->post(route('demo.switch'), ['email' => $other->email])
        ->assertSessionHasErrors('email');

    $this->assertAuthenticatedAs($hr);
});

it('is not available outside the local demo', function (string $environment, bool $enabled) {
    useSwitchEnvironment($environment, $enabled);
    $hr = User::query()->where('email', 'hr@demo.test')->firstOrFail();

    $this->actingAs($hr)
        ->withHeader('Sec-Fetch-Site', 'same-origin')
        ->post(route('demo.switch'), ['email' => 'admin@demo.test'])
        ->assertNotFound();

    $this->assertAuthenticatedAs($hr);
})->with([
    'production' => ['production', true],
    'flag off' => ['local', false],
]);

it('requires a signed-in user', function () {
    useSwitchEnvironment('local', true);

    $this->withHeader('Sec-Fetch-Site', 'same-origin')
        ->post(route('demo.switch'), ['email' => 'admin@demo.test'])
        ->assertRedirect(route('login'));

    $this->assertGuest();
});
