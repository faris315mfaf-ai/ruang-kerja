<?php

namespace App\Domain\Organization\Services;

use App\Domain\Organization\Enums\Role;
use App\Models\User;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Support\Facades\Gate;

/**
 * Authorizes every role that is added or removed (UserPolicy::assignRole), so an
 * HR user can never grant or revoke `super_admin` — whatever the entry point.
 */
final class RoleChangeGuard
{
    /**
     * @param  list<Role>  $before
     * @param  list<Role>  $after
     *
     * @throws AuthorizationException
     */
    public function authorize(User $actor, User $target, array $before, array $after): void
    {
        foreach ($this->changed($before, $after) as $role) {
            Gate::forUser($actor)->authorize('assignRole', [$target, $role]);
        }
    }

    /**
     * @param  list<Role>  $before
     * @param  list<Role>  $after
     */
    public function allows(User $actor, User $target, array $before, array $after): bool
    {
        foreach ($this->changed($before, $after) as $role) {
            if (Gate::forUser($actor)->denies('assignRole', [$target, $role])) {
                return false;
            }
        }

        return true;
    }

    /**
     * Roles added or removed.
     *
     * @param  list<Role>  $before
     * @param  list<Role>  $after
     * @return list<Role>
     */
    public function changed(array $before, array $after): array
    {
        $changed = [];

        foreach (Role::cases() as $role) {
            if (in_array($role, $before, true) !== in_array($role, $after, true)) {
                $changed[] = $role;
            }
        }

        return $changed;
    }

    /**
     * @return list<Role>
     */
    public static function rolesOf(User $user): array
    {
        $roles = [];

        foreach ($user->getRoleNames() as $name) {
            $role = Role::tryFrom($name);

            if ($role !== null) {
                $roles[] = $role;
            }
        }

        return $roles;
    }
}
