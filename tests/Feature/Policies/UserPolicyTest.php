<?php

use App\Domain\Organization\Enums\Role;
use App\Models\User;
use App\Policies\UserPolicy;
use Database\Seeders\RoleSeeder;
use Illuminate\Support\Facades\Gate;

beforeEach(function () {
    $this->seed(RoleSeeder::class);
});

it('is auto-discovered for the User model', function () {
    expect(Gate::getPolicyFor(User::class))->toBeInstanceOf(UserPolicy::class);
});

it('lets every role update only their own theme', function (Role $role) {
    $actor = User::factory()->create();
    $actor->assignRole($role->value);
    $other = User::factory()->create();

    $policy = new UserPolicy;

    expect($policy->updateTheme($actor, $actor))->toBeTrue()
        ->and($policy->updateTheme($actor, $other))->toBeFalse()
        ->and(Gate::forUser($actor)->allows('updateTheme', $actor))->toBeTrue()
        ->and(Gate::forUser($actor)->allows('updateTheme', $other))->toBeFalse();
})->with(Role::cases());
