<?php

namespace App\Policies;

use App\Domain\Workspaces\Enums\WorkspaceRole;
use App\Models\Task;
use App\Models\User;
use Illuminate\Auth\Access\Response;

/**
 * Tasks follow their workspace (WorkspacePolicy): invisible workspace → 404,
 * viewer or archived → 403. Deleting needs the creator or a workspace admin.
 */
class TaskPolicy
{
    public function __construct(private readonly WorkspacePolicy $workspaces) {}

    /**
     * Lists are always scoped with Task::visibleTo() / MyTasks.
     */
    public function viewAny(User $user): bool
    {
        return true;
    }

    public function view(User $user, Task $task): Response
    {
        return $this->workspaces->view($user, $task->workspace);
    }

    public function update(User $user, Task $task): Response
    {
        return $this->workspaces->editTasks($user, $task->workspace);
    }

    public function move(User $user, Task $task): Response
    {
        return $this->workspaces->editTasks($user, $task->workspace);
    }

    /**
     * Comment and react: everyone who can see the workspace (Direksi may give
     * direction on read-only workspaces), while the workspace is not archived.
     */
    public function comment(User $user, Task $task): Response
    {
        $workspace = $task->workspace;

        if (! $this->workspaces->canView($user, $workspace)) {
            return Response::denyAsNotFound();
        }

        return $workspace->isArchived()
            ? Response::deny('Workspace diarsipkan: komentar tidak dapat ditambahkan.')
            : Response::allow();
    }

    /**
     * Follow / unfollow (task_watchers): everyone who can see the task.
     */
    public function watch(User $user, Task $task): Response
    {
        return $this->workspaces->view($user, $task->workspace);
    }

    public function delete(User $user, Task $task): Response
    {
        $workspace = $task->workspace;
        $allowed = $this->workspaces->canEditTasks($user, $workspace)
            && ($task->created_by === $user->id
                || $workspace->isPersonal()
                || ($workspace->roleOf($user)?->atLeast(WorkspaceRole::Admin) ?? false));

        if ($allowed) {
            return Response::allow();
        }

        return $this->workspaces->canView($user, $workspace)
            ? Response::deny('Hanya pembuat tugas atau admin workspace yang dapat menghapus.')
            : Response::denyAsNotFound();
    }
}
