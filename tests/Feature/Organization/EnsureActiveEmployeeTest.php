<?php

use App\Domain\Organization\Enums\UserStatus;
use App\Http\Middleware\EnsureActiveEmployee;
use App\Models\User;

it('lets active employees through', function () {
    $user = User::factory()->create();

    $this->actingAs($user)->get(route('dashboard'))->assertOk();

    $this->assertAuthenticatedAs($user);
});

it('logs out inactive and resigned employees with an Indonesian message', function (UserStatus $status) {
    $user = User::factory()->create(['status' => $status]);

    $this->actingAs($user)
        ->get(route('dashboard'))
        ->assertRedirect(route('login'))
        ->assertSessionHasErrors(['email' => EnsureActiveEmployee::MESSAGE]);

    $this->assertGuest();
})->with([UserStatus::Inactive, UserStatus::Resigned]);

it('logs out a user deactivated in the middle of a session', function () {
    $user = User::factory()->create();

    $this->actingAs($user)->get(route('dashboard'))->assertOk();

    User::query()->whereKey($user->id)->update(['status' => UserStatus::Inactive->value]);
    $user->refresh();

    $this->get(route('profile.edit'))->assertRedirect(route('login'));
    $this->assertGuest();
});

it('answers 401 to JSON requests from inactive users', function () {
    $user = User::factory()->inactive()->create();

    $this->actingAs($user)->getJson(route('dashboard'))->assertUnauthorized();

    $this->assertGuest();
});

it('does not affect guests', function () {
    $this->get(route('login'))->assertOk();
});
