<?php

namespace App\Domain\Workspaces\Services;

use App\Domain\Google\Contracts\WorkspaceDriveAccess;
use App\Models\User;
use App\Models\Workspace;
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
 */
final class WorkspacePolicyDriveAccess implements WorkspaceDriveAccess
{
    public function __construct(private readonly WorkspacePolicy $policy) {}

    public function canView(User $user, string $workspaceId): bool
    {
        $workspace = $this->workspace($workspaceId);

        return $workspace !== null && $this->policy->canView($user, $workspace);
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
        return $query->whereIn($workspaceColumn, Workspace::query()->visibleTo($user)->select('workspaces.id'));
    }

    private function workspace(string $id): ?Workspace
    {
        return Workspace::query()->find($id);
    }
}
