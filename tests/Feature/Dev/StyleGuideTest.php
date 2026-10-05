<?php

use App\Domain\Organization\Enums\Role;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    $this->seed(RoleSeeder::class);
});

test('Super Admin opens the style guide in the local environment', function () {
    app()->detectEnvironment(fn () => 'local');
    $admin = User::factory()->withRole(Role::SuperAdmin)->create();

    $this->actingAs($admin)
        ->get('/dev/komponen')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page->component('dev/komponen'));
});

test('other roles cannot open the style guide', function (Role $role) {
    app()->detectEnvironment(fn () => 'local');
    $user = User::factory()->withRole($role)->create();

    $this->actingAs($user)->get('/dev/komponen')->assertForbidden();
})->with([Role::Hr, Role::Direksi, Role::KepalaDivisi, Role::Anggota]);

test('the style guide does not exist outside the local environment', function () {
    $admin = User::factory()->withRole(Role::SuperAdmin)->create();

    $this->actingAs($admin)->get('/dev/komponen')->assertNotFound();
});

test('guests are sent to the login page', function () {
    app()->detectEnvironment(fn () => 'local');

    $this->get('/dev/komponen')->assertRedirect('/login');
});
