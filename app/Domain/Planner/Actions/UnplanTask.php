<?php

namespace App\Domain\Planner\Actions;

use App\Models\Task;
use App\Models\TaskPlan;
use App\Models\User;

/**
 * "Kembalikan otomatis": the task goes back to its automatic lane (by due
 * date). The row stays with seen_at so an accepted assignment does not pop
 * back into "tugas baru".
 */
final class UnplanTask
{
    public function handle(User $user, Task $task): TaskPlan
    {
        $plan = TaskPlan::query()->ownedBy($user)->where('task_id', $task->id)->first()
            ?? new TaskPlan(['user_id' => $user->id, 'task_id' => $task->id]);

        $plan->bucket = null;
        $plan->position = null;
        $plan->planned_for = null;
        $plan->seen_at ??= now()->toImmutable();
        $plan->save();

        return $plan;
    }
}
