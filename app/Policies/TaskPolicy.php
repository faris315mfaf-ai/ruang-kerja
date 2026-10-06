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
    public const string VIEW_ONLY = 'Mode lihat saja: Anda bukan anggota workspace ini.';

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
     * Comment and react: everyone who can see the workspace while it is not
     * archived — except management viewing a workspace they are not a member
     * of (view only, keputusan pemilik 6 Okt 2026; Direksi steer projects
     * through "Beri arahan" instead).
     */
    public function comment(User $user, Task $task): Response
    {
        $workspace = $task->workspace;

        if (! $this->workspaces->canView($user, $workspace)) {
            return Response::denyAsNotFound();
        }

        if ($workspace->isArchived()) {
            return Response::deny('Workspace diarsipkan: komentar tidak dapat ditambahkan.');
        }

        return $this->workspaces->isViewOnly($user, $workspace)
            ? Response::deny(self::VIEW_ONLY)
            : Response::allow();
    }

    /**
     * Follow / unfollow (task_watchers): everyone who can see the task, except
     * view-only management (watchers are listed on the task).
     */
    public function watch(User $user, Task $task): Response
    {
        $workspace = $task->workspace;

        if (! $this->workspaces->canView($user, $workspace)) {
            return Response::denyAsNotFound();
        }

        return $this->workspaces->isViewOnly($user, $workspace)
            ? Response::deny(self::VIEW_ONLY)
            : Response::allow();
    }

    /**
     * "Ruang saya" (Beranda): plan, accept and quick-complete — only tasks
     * assigned to the user or living in their own personal workspace, in a
     * workspace they can see and that is not archived. Completing also needs
     * move().
     */
    public function plan(User $user, Task $task): Response
    {
        $workspace = $task->workspace;

        if (! $this->workspaces->canView($user, $workspace)) {
            return Response::denyAsNotFound();
        }

        if ($workspace->isArchived()) {
            return Response::deny('Workspace diarsipkan: tugas tidak dapat direncanakan.');
        }

        $own = ($workspace->isPersonal() && $workspace->owner_id === $user->id)
            || $task->assignees()->where('users.id', $user->id)->exists();

        return $own
            ? Response::allow()
            : Response::deny('Hanya tugas yang ditugaskan kepada Anda atau catatan pribadi Anda yang bisa direncanakan.');
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
