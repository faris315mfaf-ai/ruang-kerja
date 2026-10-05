<?php

use App\Domain\Organization\Enums\Role;
use App\Models\Company;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Broadcasting\BroadcastManager;

/*
 * `company.{company}.attendance` (review fix 3-9 B): the live attendance feed
 * of one company, only for viewers of that company holding attendance.view_all.
 */

beforeEach(function () {
    $this->seed(RoleSeeder::class);
    $this->channel = app(BroadcastManager::class)->connection()->getChannels()->get('company.{company}.attendance');
});

it('authorizes HR of the same company, also when there are several companies', function () {
    $hr = User::factory()->withRole(Role::Hr)->create();
    Company::factory()->create();

    expect(($this->channel)($hr, $hr->company))->toBeTrue()
        ->and(($this->channel)(User::factory()->withRole(Role::Direksi)->create(['company_id' => $hr->company_id]), $hr->company))->toBeTrue();
});

it('denies a viewer of another company', function () {
    $hr = User::factory()->withRole(Role::Hr)->create();
    $other = Company::factory()->create();
    $otherHr = User::factory()->withRole(Role::Hr)->create(['company_id' => $other->id]);
    $otherAdmin = User::factory()->withRole(Role::SuperAdmin)->create(['company_id' => $other->id]);

    expect(($this->channel)($otherHr, $hr->company))->toBeFalse()
        ->and(($this->channel)($otherAdmin, $hr->company))->toBeFalse()
        ->and(($this->channel)($hr, $other))->toBeFalse();
});

it('denies same-company viewers without the company-wide attendance permission', function () {
    $member = User::factory()->withRole(Role::Anggota)->create();
    $kadiv = User::factory()->withRole(Role::KepalaDivisi)->create(['company_id' => $member->company_id]);

    expect(($this->channel)($member, $member->company))->toBeFalse()
        ->and(($this->channel)($kadiv, $member->company))->toBeFalse();
});
