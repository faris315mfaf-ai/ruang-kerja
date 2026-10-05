<?php

use App\Domain\Organization\Enums\Role;
use App\Models\Company;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Broadcasting\BroadcastManager;

/*
 * `company.attendance` has no company id in its name: it is only authorized
 * for a viewer of the installation's single company.
 */

beforeEach(function () {
    $this->seed(RoleSeeder::class);
    $this->channel = app(BroadcastManager::class)->connection()->getChannels()->get('company.attendance');
});

it('authorizes HR of the single company', function () {
    expect(($this->channel)(User::factory()->withRole(Role::Hr)->create()))->toBeTrue()
        ->and(($this->channel)(User::factory()->withRole(Role::Anggota)->create()))->toBeFalse();
});

it('refuses the shared channel once there is more than one company', function () {
    $hr = User::factory()->withRole(Role::Hr)->create();
    $other = Company::factory()->create();
    $otherHr = User::factory()->withRole(Role::Hr)->create(['company_id' => $other->id]);

    expect(($this->channel)($hr))->toBeFalse()
        ->and(($this->channel)($otherHr))->toBeFalse();
});
