<?php

use App\Domain\Organization\Enums\Role;
use App\Models\InboxNotification;
use App\Models\NotificationPreference;
use App\Models\NotificationSetting;
use App\Models\User;
use App\Policies\InboxNotificationPolicy;
use App\Policies\NotificationPreferencePolicy;
use App\Policies\NotificationSettingPolicy;
use Database\Seeders\RoleSeeder;
use Illuminate\Support\Facades\Gate;

beforeEach(function () {
    $this->seed(RoleSeeder::class);
});

function userWithRole(Role $role): User
{
    $user = User::factory()->create();
    $user->assignRole($role->value);

    return $user;
}

it('is auto-discovered for the notification models', function () {
    expect(Gate::getPolicyFor(InboxNotification::class))->toBeInstanceOf(InboxNotificationPolicy::class)
        ->and(Gate::getPolicyFor(NotificationPreference::class))->toBeInstanceOf(NotificationPreferencePolicy::class)
        ->and(Gate::getPolicyFor(NotificationSetting::class))->toBeInstanceOf(NotificationSettingPolicy::class);
});

it('lets every role view and update only their own notifications', function (Role $role) {
    $actor = userWithRole($role);
    $own = InboxNotification::factory()->recipient($actor)->create();
    $foreign = InboxNotification::factory()->create();
    $gate = Gate::forUser($actor);

    expect($gate->allows('viewAny', InboxNotification::class))->toBeTrue()
        ->and($gate->allows('view', $own))->toBeTrue()
        ->and($gate->allows('update', $own))->toBeTrue()
        ->and($gate->allows('view', $foreign))->toBeFalse()
        ->and($gate->allows('update', $foreign))->toBeFalse();
})->with(Role::cases());

it('lets every role manage only their own notification preferences', function (Role $role) {
    $actor = userWithRole($role);
    $other = User::factory()->create();
    $ownRow = NotificationPreference::query()->create(['user_id' => $actor->id, 'event' => 'mention', 'channel' => 'email', 'enabled' => false]);
    $otherRow = NotificationPreference::query()->create(['user_id' => $other->id, 'event' => 'mention', 'channel' => 'email', 'enabled' => false]);
    $gate = Gate::forUser($actor);

    expect($gate->allows('manage', [NotificationPreference::class, $actor]))->toBeTrue()
        ->and($gate->allows('manage', [NotificationPreference::class, $other]))->toBeFalse()
        ->and($gate->allows('update', $ownRow))->toBeTrue()
        ->and($gate->allows('update', $otherRow))->toBeFalse();
})->with(Role::cases());

it('lets every role view and update only their own notification settings', function (Role $role) {
    $actor = userWithRole($role);
    $other = User::factory()->create();
    $gate = Gate::forUser($actor);

    expect($gate->allows('view', NotificationSetting::for($actor)))->toBeTrue()
        ->and($gate->allows('update', NotificationSetting::for($actor)))->toBeTrue()
        ->and($gate->allows('view', NotificationSetting::for($other)))->toBeFalse()
        ->and($gate->allows('update', NotificationSetting::for($other)))->toBeFalse();
})->with(Role::cases());
