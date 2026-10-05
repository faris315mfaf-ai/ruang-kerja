<?php

use App\Domain\Tasks\Actions\CreateTask;
use App\Models\Task;
use App\Models\User;
use App\Models\Workspace;

/*
 * Shared helpers for the Ruang saya tests (require_once in each file).
 */

if (! function_exists('selfTask')) {
    /**
     * A task $user created and assigned to themselves (never "new").
     */
    function selfTask(Workspace $workspace, User $user, string $title, ?string $due = null, bool $addAsMember = false): Task
    {
        if ($addAsMember) {
            addMember($workspace, $user);
        }

        return app(CreateTask::class)->handle($workspace, $user, ['title' => $title, 'due_date' => $due, 'assignee_ids' => [$user->id]]);
    }

    /**
     * A task $assigner created and assigned to $assignee (task_assignees.assigned_by = $assigner).
     */
    function assignTask(Workspace $workspace, User $assigner, User $assignee, string $title, ?string $due = null): Task
    {
        return app(CreateTask::class)->handle($workspace, $assigner, ['title' => $title, 'due_date' => $due, 'assignee_ids' => [$assignee->id]]);
    }
}
