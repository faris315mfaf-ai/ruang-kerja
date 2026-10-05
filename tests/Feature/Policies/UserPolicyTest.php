<?php

use App\Domain\Organization\Enums\Role;
use App\Models\Company;
use App\Models\Division;
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

it('applies the employee management matrix', function (Role $role, array $expected) {
    $actor = User::factory()->withRole($role)->create();
    $target = User::factory()->withRole(Role::Anggota)->create();
    $gate = Gate::forUser($actor);

    expect([
        'viewAny' => $gate->allows('viewAny', User::class),
        'manage' => $gate->allows('manage', User::class),
        'view' => $gate->allows('view', $target),
        'create' => $gate->allows('create', User::class),
        'update' => $gate->allows('update', $target),
        'deactivate' => $gate->allows('deactivate', $target),
        'delete' => $gate->allows('delete', $target),
        'assignAnggota' => $gate->allows('assignRole', [$target, Role::Anggota]),
        'assignSuperAdmin' => $gate->allows('assignRole', [$target, Role::SuperAdmin]),
    ])->toBe($expected);
})->with([
    'super_admin' => [Role::SuperAdmin, ['viewAny' => true, 'manage' => true, 'view' => true, 'create' => true, 'update' => true, 'deactivate' => true, 'delete' => false, 'assignAnggota' => true, 'assignSuperAdmin' => true]],
    'hr' => [Role::Hr, ['viewAny' => true, 'manage' => true, 'view' => true, 'create' => true, 'update' => true, 'deactivate' => true, 'delete' => false, 'assignAnggota' => true, 'assignSuperAdmin' => false]],
    'direksi' => [Role::Direksi, ['viewAny' => true, 'manage' => false, 'view' => true, 'create' => false, 'update' => false, 'deactivate' => false, 'delete' => false, 'assignAnggota' => false, 'assignSuperAdmin' => false]],
    'kepala_divisi' => [Role::KepalaDivisi, ['viewAny' => true, 'manage' => false, 'view' => false, 'create' => false, 'update' => false, 'deactivate' => false, 'delete' => false, 'assignAnggota' => false, 'assignSuperAdmin' => false]],
    'anggota' => [Role::Anggota, ['viewAny' => false, 'manage' => false, 'view' => false, 'create' => false, 'update' => false, 'deactivate' => false, 'delete' => false, 'assignAnggota' => false, 'assignSuperAdmin' => false]],
]);

it('lets a kepala divisi view members of their own division only', function () {
    $ops = Division::factory()->create();
    $keu = Division::factory()->create();
    $kadiv = User::factory()->withRole(Role::KepalaDivisi)->inDivision($ops)->create();
    $member = User::factory()->inDivision($ops)->create();
    $other = User::factory()->inDivision($keu)->create();
    $gate = Gate::forUser($kadiv);

    expect($gate->allows('view', $member))->toBeTrue()
        ->and($gate->allows('view', $other))->toBeFalse()
        ->and($gate->allows('update', $member))->toBeFalse();
});

it('lets an anggota view only themselves and their direct reports', function () {
    $lead = User::factory()->withRole(Role::Anggota)->create();
    $report = User::factory()->managedBy($lead)->create();
    $peer = User::factory()->create();
    $gate = Gate::forUser($lead);

    expect($gate->allows('view', $lead))->toBeTrue()
        ->and($gate->allows('view', $report))->toBeTrue()
        ->and($gate->allows('view', $peer))->toBeFalse();
});

it('protects super admins from HR edits and self-deactivation', function () {
    $hr = User::factory()->withRole(Role::Hr)->create();
    $admin = User::factory()->withRole(Role::SuperAdmin)->create();
    $otherAdmin = User::factory()->withRole(Role::SuperAdmin)->create();

    expect(Gate::forUser($hr)->allows('update', $admin))->toBeFalse()
        ->and(Gate::forUser($hr)->allows('deactivate', $admin))->toBeFalse()
        ->and(Gate::forUser($hr)->allows('assignRole', [$admin, Role::Anggota]))->toBeFalse()
        ->and(Gate::forUser($hr)->allows('deactivate', $hr))->toBeFalse()
        ->and(Gate::forUser($admin)->allows('update', $otherAdmin))->toBeTrue()
        ->and(Gate::forUser($admin)->allows('deactivate', $otherAdmin))->toBeTrue()
        ->and(Gate::forUser($admin)->allows('deactivate', $admin))->toBeFalse();
});

it('denies managing employees of another company', function () {
    $hr = User::factory()->withRole(Role::Hr)->create();
    $foreign = User::factory()->forCompany(Company::factory()->create())->create();
    $gate = Gate::forUser($hr);

    expect($gate->allows('view', $foreign))->toBeFalse()
        ->and($gate->allows('update', $foreign))->toBeFalse()
        ->and($gate->allows('deactivate', $foreign))->toBeFalse();
});

it('lets only a Super Admin manage their own password and 2FA', function (Role $role, bool $expected) {
    $actor = User::factory()->withRole($role)->create();
    $otherAdmin = User::factory()->withRole(Role::SuperAdmin)->create();
    $gate = Gate::forUser($actor);

    expect($gate->allows('manageCredentials', $actor))->toBe($expected)
        ->and($gate->allows('manageCredentials', $otherAdmin))->toBeFalse();
})->with([
    'super_admin' => [Role::SuperAdmin, true],
    'direksi' => [Role::Direksi, false],
    'hr' => [Role::Hr, false],
    'kepala_divisi' => [Role::KepalaDivisi, false],
    'anggota' => [Role::Anggota, false],
]);

it('applies the role assignment matrix', function (Role $actorRole, array $expected) {
    $actor = User::factory()->withRole($actorRole)->create();
    $target = User::factory()->withRole(Role::Anggota)->create();
    $gate = Gate::forUser($actor);

    $actual = [];

    foreach (Role::cases() as $role) {
        $actual[$role->value] = $gate->allows('assignRole', [$target, $role]);
    }

    expect($actual)->toBe($expected);
})->with([
    'super_admin grants everything' => [Role::SuperAdmin, ['super_admin' => true, 'direksi' => true, 'hr' => true, 'kepala_divisi' => true, 'anggota' => true]],
    'hr grants kepala_divisi/anggota only' => [Role::Hr, ['super_admin' => false, 'direksi' => false, 'hr' => false, 'kepala_divisi' => true, 'anggota' => true]],
    'direksi grants nothing' => [Role::Direksi, ['super_admin' => false, 'direksi' => false, 'hr' => false, 'kepala_divisi' => false, 'anggota' => false]],
    'kepala_divisi grants nothing' => [Role::KepalaDivisi, ['super_admin' => false, 'direksi' => false, 'hr' => false, 'kepala_divisi' => false, 'anggota' => false]],
    'anggota grants nothing' => [Role::Anggota, ['super_admin' => false, 'direksi' => false, 'hr' => false, 'kepala_divisi' => false, 'anggota' => false]],
]);

it('never lets anyone change their own roles', function (Role $actorRole) {
    $actor = User::factory()->withRole($actorRole)->create();
    $gate = Gate::forUser($actor);

    foreach (Role::cases() as $role) {
        expect($gate->allows('assignRole', [$actor, $role]))->toBeFalse();
    }
})->with([Role::SuperAdmin, Role::Hr]);
