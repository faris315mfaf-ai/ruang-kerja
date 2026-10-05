<?php

namespace App\Domain\Planner\Actions;

use App\Domain\Planner\Enums\PlanBucket;
use App\Domain\Tasks\Actions\CreateTask;
use App\Models\Task;
use App\Models\User;
use App\Models\Workspace;

/**
 * "Tambah catatan pribadi": a task in the user's personal workspace
 * (CreateTask, assigned to themselves so it also shows in Tugas saya and the
 * dashboard metrics), planned in $bucket (default "Hari ini").
 */
final class QuickAddPersonalTask
{
    public function __construct(
        private readonly CreateTask $createTask,
        private readonly PlanTask $planTask,
    ) {}

    public function handle(Workspace $personal, User $user, string $title, PlanBucket $bucket = PlanBucket::Today): Task
    {
        $task = $this->createTask->handle($personal, $user, [
            'title' => $title,
            'assignee_ids' => [$user->id],
        ]);

        $this->planTask->handle($user, $task, $bucket);

        return $task;
    }
}
