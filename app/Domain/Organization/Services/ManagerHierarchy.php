<?php

namespace App\Domain\Organization\Services;

use App\Models\User;

/**
 * Reporting-line helpers (users.manager_id = atasan langsung).
 */
final class ManagerHierarchy
{
    /**
     * Upper bound for walking the chain; real org charts are far shallower.
     */
    public const int MAX_DEPTH = 50;

    /**
     * Whether making $newManager the manager of $user would create a reporting
     * cycle (A → B → A, or deeper). Null (no manager) never does.
     */
    public function wouldCreateCycle(User $user, ?User $newManager): bool
    {
        if ($newManager === null) {
            return false;
        }

        if ($newManager->is($user)) {
            return true;
        }

        $visited = [];
        $current = $newManager->manager_id;

        while ($current !== null) {
            if ($current === $user->id || isset($visited[$current]) || count($visited) >= self::MAX_DEPTH) {
                // Reaching the user closes a cycle; an existing loop or absurd depth is rejected too.
                return true;
            }

            $visited[$current] = true;
            $next = User::query()->whereKey($current)->value('manager_id');
            $current = is_string($next) ? $next : null;
        }

        return false;
    }

    /**
     * Managers above the user, nearest first (direct manager, their manager, …).
     * Useful for approval routing. Stops at the top or on a corrupted loop.
     *
     * @return list<User>
     */
    public function chainOf(User $user): array
    {
        $chain = [];
        $seen = [$user->id => true];
        $managerId = $user->manager_id;

        while ($managerId !== null && ! isset($seen[$managerId]) && count($chain) < self::MAX_DEPTH) {
            $manager = User::query()->find($managerId);

            if ($manager === null) {
                break;
            }

            $chain[] = $manager;
            $seen[$managerId] = true;
            $managerId = $manager->manager_id;
        }

        return $chain;
    }
}
