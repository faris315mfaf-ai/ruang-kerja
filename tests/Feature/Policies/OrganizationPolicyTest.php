<?php

use App\Domain\Organization\Enums\Role;
use App\Models\Company;
use App\Models\Division;
use App\Models\Position;
use App\Models\Team;
use App\Models\User;
use App\Policies\CompanyPolicy;
use App\Policies\DivisionPolicy;
use App\Policies\PositionPolicy;
use App\Policies\TeamPolicy;
use Database\Seeders\RoleSeeder;
use Illuminate\Support\Facades\Gate;

beforeEach(function () {
    $this->seed(RoleSeeder::class);
});

it('auto-discovers the organization policies', function () {
    expect(Gate::getPolicyFor(Company::class))->toBeInstanceOf(CompanyPolicy::class)
        ->and(Gate::getPolicyFor(Division::class))->toBeInstanceOf(DivisionPolicy::class)
        ->and(Gate::getPolicyFor(Team::class))->toBeInstanceOf(TeamPolicy::class)
        ->and(Gate::getPolicyFor(Position::class))->toBeInstanceOf(PositionPolicy::class);
});

dataset('org units', [
    'division' => [fn () => Division::factory()->create()],
    'team' => [fn () => Team::factory()->create()],
    'position' => [fn () => Position::factory()->create()],
]);

dataset('roles that manage org', [
    'super_admin' => [Role::SuperAdmin, true],
    'hr' => [Role::Hr, true],
    'direksi' => [Role::Direksi, false],
    'kepala_divisi' => [Role::KepalaDivisi, false],
    'anggota' => [Role::Anggota, false],
]);

it('lets everyone in the company view org units', function (Closure $make, Role $role) {
    $unit = $make();
    $actor = User::factory()->withRole($role)->create();
    $gate = Gate::forUser($actor);

    expect($gate->allows('viewAny', $unit::class))->toBeTrue()
        ->and($gate->allows('view', $unit))->toBeTrue();
})->with('org units')->with(Role::cases());

it('lets only HR and Super Admin manage org units', function (Closure $make, Role $role, bool $expected) {
    $unit = $make();
    $actor = User::factory()->withRole($role)->create();
    $gate = Gate::forUser($actor);

    expect($gate->allows('create', $unit::class))->toBe($expected)
        ->and($gate->allows('update', $unit))->toBe($expected)
        ->and($gate->allows('delete', $unit))->toBe($expected)
        ->and($gate->allows('restore', $unit))->toBe($expected)
        ->and($gate->allows('forceDelete', $unit))->toBeFalse();
})->with('org units')->with('roles that manage org');

it('denies access to org units of another company', function (Closure $make) {
    $unit = $make();
    $actor = User::factory()->forCompany(Company::factory()->create())->withRole(Role::SuperAdmin)->create();
    $gate = Gate::forUser($actor);

    expect($gate->allows('view', $unit))->toBeFalse()
        ->and($gate->allows('update', $unit))->toBeFalse()
        ->and($gate->allows('delete', $unit))->toBeFalse();
})->with('org units');

it('lets only Super Admin update the company', function (Role $role, bool $expected) {
    $actor = User::factory()->withRole($role)->create();
    $gate = Gate::forUser($actor);

    expect($gate->allows('view', $actor->company))->toBeTrue()
        ->and($gate->allows('update', $actor->company))->toBe($expected)
        ->and($gate->allows('viewAny', Company::class))->toBe($expected)
        ->and($gate->allows('create', Company::class))->toBeFalse()
        ->and($gate->allows('delete', $actor->company))->toBeFalse()
        ->and($gate->allows('view', Company::factory()->create()))->toBeFalse();
})->with([
    [Role::SuperAdmin, true],
    [Role::Hr, false],
    [Role::Direksi, false],
    [Role::KepalaDivisi, false],
    [Role::Anggota, false],
]);
