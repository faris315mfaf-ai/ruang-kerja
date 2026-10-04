<?php

namespace App\Domain\Organization\Actions;

use App\Domain\Organization\Enums\Role;
use App\Domain\Organization\Services\AuditLogger;
use App\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * The ONLY place feature code should change a user's global roles: syncs them
 * and writes one `user.roles_changed` audit row when the set actually changed.
 * Authorize first with Gate `assignRole` (UserPolicy) for every added/removed role.
 */
final readonly class SyncUserRoles
{
    public function __construct(private AuditLogger $audit) {}

    /**
     * @param  list<Role>  $roles
     */
    public function handle(User $user, array $roles, ?User $actor = null): void
    {
        DB::transaction(function () use ($user, $roles, $actor): void {
            $before = $this->roleNames($user);

            $user->syncRoles(array_map(fn (Role $role): string => $role->value, $roles));
            $user->unsetRelation('roles');

            $after = $this->roleNames($user);

            if ($before !== $after) {
                $this->audit->log('user.roles_changed', $user, ['roles' => $before], ['roles' => $after], $actor);
            }
        });
    }

    /**
     * @return list<string>
     */
    private function roleNames(User $user): array
    {
        /** @var list<string> $names */
        $names = $user->roles()->pluck('name')->sort()->values()->all();

        return $names;
    }
}
