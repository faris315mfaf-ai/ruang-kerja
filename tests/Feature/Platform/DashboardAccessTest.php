<?php

use App\Domain\Organization\Enums\Role;
use App\Models\User;
use Database\Seeders\RoleSeeder;

beforeEach(function () {
    $this->seed(RoleSeeder::class);
});

it('opens Horizon and Pulse for super_admin only', function (Role $role, string $uri) {
    $user = User::factory()->withRole($role)->create();

    $response = $this->actingAs($user)->get($uri);

    $role === Role::SuperAdmin ? $response->assertOk() : $response->assertForbidden();
})->with(Role::cases())->with(['/horizon', '/pulse']);

it('hides Horizon and Pulse from guests', function (string $uri) {
    $this->get($uri)->assertForbidden();
})->with(['/horizon', '/pulse']);
