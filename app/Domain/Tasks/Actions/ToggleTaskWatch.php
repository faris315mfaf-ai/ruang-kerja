<?php

namespace App\Domain\Tasks\Actions;

use App\Domain\Tasks\Services\TaskRelations;
use App\Models\Task;
use App\Models\User;

/**
 * Follow (pengamat) or unfollow a task.
 */
final class ToggleTaskWatch
{
    public function __construct(private readonly TaskRelations $relations) {}

    public function handle(Task $task, User $user, bool $watch): void
    {
        if ($watch) {
            $this->relations->watch($task, [$user->id], now());

            return;
        }

        $task->watchers()->detach($user->id);
    }
}
