<?php

namespace App\Policies;

use App\Domain\Workspaces\Enums\WorkspaceRole;
use App\Models\Task;
use App\Models\User;
use Illuminate\Auth\Access\Response;

/**
 * Tasks follow their workspace (WorkspacePolicy): invisible workspace → 404,
 * viewer or archived → 403. Deleting needs the creator or a workspace admin.
 *
 * Sunting/hapus (keputusan pemilik 9 Okt 2026):
 * - tugas pribadi buatan sendiri — termasuk hasil rencana kerja absensi —
 *   boleh diedit/dihapus pembuatnya (workspace pribadi hanya pemilik);
 * - tugas yang DITUGASKAN orang lain kepada karyawan hanya boleh diubah atau
 *   dihapus oleh pembuatnya atau atasannya (admin/owner workspace atau
 *   manajer langsung salah satu penerima tugas) — anggota lain yang bukan
 *   pembuat/atasan juga tidak; si penerima tetap bisa mengerjakan tugasnya
 *   (move, comment, plan, work: checklist & lampiran);
 * - tugas tim lainnya (tanpa penerima) mengikuti kebijakan workspace (editTasks).
 *
 * Tugas privat (Penugasan HR, keputusan pemilik 20 Okt 2026): di workspace
 * `tasks_private` hanya owner/admin (HR) yang melihat semua tugas; orang lain
 * yang bisa membuka workspace hanya melihat tugas yang ditugaskan kepadanya —
 * tugas lain 404 di setiap aksi (hiddenPrivate()).
 */
class TaskPolicy
{
    public const string VIEW_ONLY = 'Mode lihat saja: Anda bukan anggota workspace ini.';

    public const string ASSIGNED_BY_OTHER = 'Tugas yang ditugaskan orang lain hanya dapat diubah atau dihapus oleh pembuatnya atau atasan.';

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
        return $this->hiddenPrivate($user, $task) ?? $this->workspaces->view($user, $task->workspace);
    }

    /**
     * Can $user see this one task? Workspace visibility plus the private-task
     * rule (Penugasan HR). Used by queries that need a plain boolean.
     */
    public function canSee(User $user, Task $task): bool
    {
        return $this->workspaces->canView($user, $task->workspace) && $this->hiddenPrivate($user, $task) === null;
    }

    public function update(User $user, Task $task): Response
    {
        return $this->hiddenPrivate($user, $task)
            ?? $this->guardAssignedByOther($user, $task)
            ?? $this->workspaces->editTasks($user, $task->workspace);
    }

    /**
     * Doing the work on a task — ticking/adding checklist lines, attaching
     * deliverables: the workspace editTasks rule without the "assigned by
     * someone else" guard, so the assignee can work on a task they may not
     * edit (keputusan pemilik 9 Okt 2026).
     */
    public function work(User $user, Task $task): Response
    {
        return $this->hiddenPrivate($user, $task) ?? $this->workspaces->editTasks($user, $task->workspace);
    }

    public function move(User $user, Task $task): Response
    {
        return $this->hiddenPrivate($user, $task) ?? $this->workspaces->editTasks($user, $task->workspace);
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

        if ($hidden = $this->hiddenPrivate($user, $task)) {
            return $hidden;
        }

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

        if ($hidden = $this->hiddenPrivate($user, $task)) {
            return $hidden;
        }

        if (! $this->workspaces->canView($user, $workspace)) {
            return Response::denyAsNotFound();
        }

        return $this->workspaces->isViewOnly($user, $workspace)
            ? Response::deny(self::VIEW_ONLY)
            : Response::allow();
    }

    /**
     * Comment read pointer (task_comment_reads, "Dibaca oleh"): everyone who
     * can see the task — also in an archived workspace — except view-only
     * management, whose reading is neither recorded nor shown (they do not
     * take part in the discussion; same rule as watch()).
     */
    public function trackCommentReads(User $user, Task $task): Response
    {
        $workspace = $task->workspace;

        if ($hidden = $this->hiddenPrivate($user, $task)) {
            return $hidden;
        }

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

        if ($hidden = $this->hiddenPrivate($user, $task)) {
            return $hidden;
        }

        if (! $this->workspaces->canView($user, $workspace)) {
            return Response::denyAsNotFound();
        }

        if ($workspace->isArchived()) {
            return Response::deny('Workspace diarsipkan: tugas tidak dapat direncanakan.');
        }

        $own = ($workspace->isPersonal() && $workspace->owner_id === $user->id)
            || $this->hasAssignee($user, $task);

        return $own
            ? Response::allow()
            : Response::deny('Hanya tugas yang ditugaskan kepada Anda atau catatan pribadi Anda yang bisa direncanakan.');
    }

    public function delete(User $user, Task $task): Response
    {
        if ($denied = $this->hiddenPrivate($user, $task) ?? $this->guardAssignedByOther($user, $task)) {
            return $denied;
        }

        $workspace = $task->workspace;
        $allowed = $this->workspaces->canEditTasks($user, $workspace)
            && ($task->created_by === $user->id
                || $workspace->isPersonal()
                || $this->managesAssignee($user, $task)
                || ($workspace->roleOf($user)?->atLeast(WorkspaceRole::Admin) ?? false));

        if ($allowed) {
            return Response::allow();
        }

        return $this->workspaces->canView($user, $workspace)
            ? Response::deny('Hanya pembuat tugas atau admin workspace yang dapat menghapus.')
            : Response::denyAsNotFound();
    }

    /**
     * Tasks someone else assigned belong to their creator (keputusan pemilik
     * 9 Okt 2026): once a task has at least one assignee, only its creator
     * or a superior — a workspace admin/owner, or the direct manager of one
     * of the assignees (who is not an assignee themselves) — may edit or
     * delete it, in any workspace, teams included. Assignees and bystander
     * members still work on it (move, comment, plan, work) but cannot edit.
     * Own tasks (created_by self, including the personal ones generated from
     * a work plan), the actor's personal workspace and unassigned tasks are
     * not restricted here.
     */
    private function guardAssignedByOther(User $user, Task $task): ?Response
    {
        $workspace = $task->workspace;

        if (! $this->workspaces->canView($user, $workspace)) {
            return Response::denyAsNotFound();
        }

        if ($workspace->isPersonal()
            || $task->created_by === $user->id
            || ! $this->hasAnyAssignee($task)) {
            return null;
        }

        $superior = ($workspace->roleOf($user)?->atLeast(WorkspaceRole::Admin) ?? false)
            || $this->managesAssignee($user, $task);

        return $superior ? null : Response::deny(self::ASSIGNED_BY_OTHER);
    }

    /**
     * 404 for a task of a private-task workspace (Penugasan HR) that $user
     * may not see: not owner/admin there and not one of its assignees.
     */
    private function hiddenPrivate(User $user, Task $task): ?Response
    {
        $workspace = $task->workspace;

        if (! $workspace->hasPrivateTasks() || $this->workspaces->seesAllTasks($user, $workspace) || $this->hasAssignee($user, $task)) {
            return null;
        }

        return Response::denyAsNotFound();
    }

    private function hasAnyAssignee(Task $task): bool
    {
        if ($task->relationLoaded('assignees')) {
            return $task->assignees->isNotEmpty();
        }

        return $task->assignees()->exists();
    }

    /**
     * Is $user one of the assignees? Reuses an eager-loaded `assignees`
     * relation (the detail presenter loads it) instead of a fresh query.
     */
    private function hasAssignee(User $user, Task $task): bool
    {
        if ($task->relationLoaded('assignees')) {
            return $task->assignees->contains('id', $user->id);
        }

        return $task->assignees()->where('users.id', $user->id)->exists();
    }

    /**
     * Is $user the direct manager (users.manager_id) of one of the assignees?
     * An assignee never qualifies this way — managing a co-assignee must not
     * unlock the task they were given themselves (a workspace admin/owner
     * role still does).
     */
    private function managesAssignee(User $user, Task $task): bool
    {
        if ($this->hasAssignee($user, $task)) {
            return false;
        }

        // Always a query: eager-loaded assignees are often partial (id, name).
        return $task->assignees()->where('users.manager_id', $user->id)->exists();
    }
}
