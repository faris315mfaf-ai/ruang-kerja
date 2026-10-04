<?php

use App\Domain\Organization\Enums\Role;
use App\Domain\Organization\Enums\WorkMode;
use App\Models\Division;
use App\Models\Position;
use App\Models\Team;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Support\Facades\Route;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    $this->seed(RoleSeeder::class);
});

it('shows the organization data read-only', function () {
    $division = Division::factory()->create(['name' => 'Operasional']);
    $team = Team::factory()->create(['division_id' => $division->id, 'name' => 'Tim Gudang']);
    $manager = User::factory()->create(['name' => 'Dimas Pratama', 'email' => 'kadiv@kantor.test']);
    $user = User::factory()
        ->inDivision($division, $team)
        ->managedBy($manager)
        ->workMode(WorkMode::Hybrid)
        ->withRole(Role::Anggota)
        ->create([
            'name' => 'Rizky Aditya',
            'email' => 'rizky@kantor.test',
            'position_id' => Position::factory()->create(['name' => 'Staf Operasional'])->id,
            'joined_at' => '2024-02-01',
        ]);

    $this->actingAs($user)->get(route('profile.edit'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('settings/profile')
            ->where('profile', [
                'name' => 'Rizky Aditya',
                'email' => 'rizky@kantor.test',
                'division' => 'Operasional',
                'team' => 'Tim Gudang',
                'position' => 'Staf Operasional',
                'manager' => ['name' => 'Dimas Pratama', 'email' => 'kadiv@kantor.test'],
                'workMode' => 'Hybrid',
                'joinedAt' => '2024-02-01',
            ])
            ->where('canManageCredentials', false),
        );
});

it('handles employees without division, position or manager', function () {
    $user = User::factory()->create();

    $this->actingAs($user)->get(route('profile.edit'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('profile.division', null)
            ->where('profile.team', null)
            ->where('profile.position', null)
            ->where('profile.manager', null),
        );
});

it('tells the page when the user may manage password and 2FA', function () {
    $admin = User::factory()->withRole(Role::SuperAdmin)->create();

    $this->actingAs($admin)->get(route('profile.edit'))
        ->assertInertia(fn (Assert $page) => $page->where('canManageCredentials', true));
});

it('does not allow changing the profile, email or deleting the account', function () {
    $user = User::factory()->create(['name' => 'Asli', 'email' => 'asli@kantor.test']);

    $this->actingAs($user)
        ->patch('/settings/profile', ['name' => 'Palsu', 'email' => 'palsu@kantor.test'])
        ->assertMethodNotAllowed();

    $this->actingAs($user)
        ->delete('/settings/profile', ['password' => 'password'])
        ->assertMethodNotAllowed();

    $user->refresh();
    expect($user->name)->toBe('Asli')
        ->and($user->email)->toBe('asli@kantor.test')
        ->and(Route::has('profile.update'))->toBeFalse()
        ->and(Route::has('profile.destroy'))->toBeFalse();
    $this->assertAuthenticatedAs($user);
});

it('requires authentication', function () {
    $this->get(route('profile.edit'))->assertRedirect(route('login'));
});
