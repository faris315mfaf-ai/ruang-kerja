<?php

use App\Domain\Organization\Enums\Permission;
use App\Domain\Organization\Enums\Role;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Spatie\Permission\Models\Permission as PermissionModel;
use Spatie\Permission\Models\Role as RoleModel;

it('seeds every permission and syncs the role matrix idempotently', function () {
    $this->seed(RoleSeeder::class);

    // Drift is corrected on re-run.
    RoleModel::findByName(Role::Anggota->value)->givePermissionTo(Permission::AuditView->value);
    $this->seed(RoleSeeder::class);

    expect(PermissionModel::query()->orderBy('name')->pluck('name')->all())
        ->toBe(collect(Permission::cases())->map->value->sort()->values()->all());

    foreach (Role::cases() as $role) {
        expect(RoleModel::findByName($role->value)->permissions->pluck('name')->sort()->values()->all())
            ->toBe(collect($role->permissions())->map->value->sort()->values()->all());
    }
});

it('grants permissions through roles', function (Role $role, Permission $permission, bool $expected) {
    $this->seed(RoleSeeder::class);
    $user = User::factory()->withRole($role)->create();

    expect($user->hasPermission($permission))->toBe($expected);
})->with([
    'super admin views audit' => [Role::SuperAdmin, Permission::AuditView, true],
    'super admin cannot see selfies' => [Role::SuperAdmin, Permission::AttendanceViewSelfie, false],
    'super admin cannot read all workspaces' => [Role::SuperAdmin, Permission::WorkspacesViewAll, false],
    'hr manages employees' => [Role::Hr, Permission::EmployeesManage, true],
    'hr manages organization' => [Role::Hr, Permission::OrganizationManage, true],
    'hr cannot view audit' => [Role::Hr, Permission::AuditView, false],
    'direksi views all employees' => [Role::Direksi, Permission::EmployeesView, true],
    'direksi cannot manage employees' => [Role::Direksi, Permission::EmployeesManage, false],
    'kadiv has no global permission' => [Role::KepalaDivisi, Permission::EmployeesView, false],
    'anggota has no global permission' => [Role::Anggota, Permission::EmployeesView, false],
]);

it('stacks permissions of multiple roles', function () {
    $this->seed(RoleSeeder::class);
    $user = User::factory()->withRole(Role::KepalaDivisi, Role::Hr)->create();

    expect($user->hasPermission(Permission::EmployeesManage))->toBeTrue()
        ->and($user->hasRole(Role::KepalaDivisi))->toBeTrue();
});

it('returns false instead of throwing when permissions are not seeded', function () {
    $user = User::factory()->create();

    expect($user->hasPermission(Permission::AuditView))->toBeFalse();
});

it('labels every role and permission in Indonesian', function () {
    expect(collect(Permission::cases())->every(fn (Permission $p) => $p->label() !== ''))->toBeTrue()
        ->and(Role::options()[0])->toBe(['value' => 'super_admin', 'label' => 'Super Admin']);
});
