<?php

namespace App\Domain\Workspaces\Services;

use App\Domain\Google\Contracts\WorkspaceDriveAccess;
use App\Domain\Workspaces\Enums\WorkspaceRole;
use App\Models\User;
use App\Models\Workspace;
use App\Models\WorkspaceMember;
use App\Policies\WorkspacePolicy;
use Illuminate\Database\Eloquent\Builder;

/**
 * Drive metadata follows workspace access (bound in WorkspaceServiceProvider,
 * replacing the fail-closed DenyWorkspaceDriveAccess of part A):
 *
 * - view (list, preview, metadata) = WorkspacePolicy::canView;
 * - contribute (upload, new document/folder, link) = WorkspacePolicy::canEditTasks
 *   (member and up, not archived);
 * - manage (remove any record) = WorkspacePolicy::canManage and not archived.
 *
 * Penugasan HR (private tasks): the workspace folder holds every employee's
 * deliverables, so listing and previewing its files is for its owner/admins
 * (HR) only; members still attach to their own tasks (contribute).
 */
final class WorkspacePolicyDriveAccess implements WorkspaceDriveAccess
{
    public function __construct(private readonly WorkspacePolicy $policy) {}

    public function canView(User $user, string $workspaceId): bool
    {
        $workspace = $this->workspace($workspaceId);

        return $workspace !== null && $this->policy->canView($user, $workspace) && $this->policy->seesAllTasks($user, $workspace);
    }

    public function canContribute(User $user, string $workspaceId): bool
    {
        $workspace = $this->workspace($workspaceId);

        return $workspace !== null && $this->policy->canEditTasks($user, $workspace);
    }

    public function canManage(User $user, string $workspaceId): bool
    {
        $workspace = $this->workspace($workspaceId);

        return $workspace !== null && ! $workspace->isArchived() && $this->policy->canManage($user, $workspace);
    }

    public function constrainVisible(Builder $query, User $user, string $workspaceColumn): Builder
    {
        return $query->whereIn($workspaceColumn, Workspace::query()
            ->visibleTo($user)
            ->where(fn (Builder $open) => $open
                ->where('workspaces.tasks_private', false)
                ->orWhereIn('workspaces.id', WorkspaceMember::query()
                    ->where('user_id', $user->id)
                    ->whereIn('role', [WorkspaceRole::Owner->value, WorkspaceRole::Admin->value])
                    ->select('workspace_id')))
            ->select('workspaces.id'));
    }

    private function workspace(string $id): ?Workspace
    {
        return Workspace::query()->find($id);
    }
}
