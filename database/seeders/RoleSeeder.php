<?php

namespace Database\Seeders;

use App\Domain\Organization\Enums\Role;
use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Role as RoleModel;
use Spatie\Permission\PermissionRegistrar;

/**
 * Global roles (docs/DATABASE.md "Peran global"). Idempotent.
 */
class RoleSeeder extends Seeder
{
    public function run(PermissionRegistrar $registrar): void
    {
        // Model events may be muted (WithoutModelEvents), so flush the cache explicitly.
        $registrar->forgetCachedPermissions();

        foreach (Role::cases() as $role) {
            RoleModel::findOrCreate($role->value, 'web');
        }

        $registrar->forgetCachedPermissions();
    }
}
