<?php

namespace App\Policies;

use App\Models\TaskPlan;
use App\Models\User;

/**
 * "Ruang saya" plans are private to their owner — not even Direksi, HR or
 * Super Admin may read them. Plans are created through TaskPolicy::plan().
 */
class TaskPlanPolicy
{
    /**
     * Lists are always TaskPlan::ownedBy($user).
     */
    public function viewAny(User $user): bool
    {
        return true;
    }

    public function view(User $user, TaskPlan $plan): bool
    {
        return $plan->user_id === $user->id;
    }

    public function update(User $user, TaskPlan $plan): bool
    {
        return $plan->user_id === $user->id;
    }

    public function delete(User $user, TaskPlan $plan): bool
    {
        return $plan->user_id === $user->id;
    }
}
