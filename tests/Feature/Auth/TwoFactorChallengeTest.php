<?php

use App\Domain\Organization\Enums\Role;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Inertia\Testing\AssertableInertia as Assert;

it('redirects to login when no sign-in is pending', function () {
    $this->get(route('two-factor.login'))->assertRedirect(route('login'));
});

it('renders the challenge after a Super Admin password sign-in', function () {
    $this->seed(RoleSeeder::class);
    $admin = User::factory()->withTwoFactor()->withRole(Role::SuperAdmin)->create();

    $this->post(route('login.store'), ['email' => $admin->email, 'password' => 'password']);

    $this->get(route('two-factor.login'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page->component('auth/two-factor-challenge'));
});
