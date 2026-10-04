<?php

use App\Domain\Organization\Enums\Role;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Inertia\Testing\AssertableInertia as Assert;

it('renders the confirm password screen for a Super Admin', function () {
    $this->seed(RoleSeeder::class);
    $admin = User::factory()->withRole(Role::SuperAdmin)->create();

    $this->actingAs($admin)->get(route('password.confirm'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page->component('auth/confirm-password'));
});

it('requires authentication', function () {
    $this->get(route('password.confirm'))->assertRedirect(route('login'));
});
