<?php

namespace Database\Seeders;

use App\Domain\Organization\Enums\Permission;
use App\Domain\Organization\Enums\Role;
use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Permission as PermissionModel;
use Spatie\Permission\Models\Role as RoleModel;
use Spatie\Permission\PermissionRegistrar;

/**
 * Global roles and their base permissions (Role::permissions()). Idempotent:
 * re-running syncs each role to exactly the matrix in code.
 */
class RoleSeeder extends Seeder
{
    public function run(PermissionRegistrar $registrar): void
    {
        // Model events may be muted (WithoutModelEvents), so flush the cache explicitly.
        $registrar->forgetCachedPermissions();

        foreach (Permission::cases() as $permission) {
            PermissionModel::findOrCreate($permission->value, 'web');
        }

        // The registrar's in-memory list predates the new rows when model events are muted.
        $registrar->forgetCachedPermissions();

        foreach (Role::cases() as $role) {
            RoleModel::findOrCreate($role->value, 'web')->syncPermissions(
                array_map(fn (Permission $permission): string => $permission->value, $role->permissions()),
            );
        }

        $registrar->forgetCachedPermissions();
    }
}
