<?php

namespace App\Domain\Automation\Services;

use App\Domain\Workspaces\Enums\WorkspaceRole;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Auth\Access\Response;

/**
 * Workspace-membership checks shared by the automation policies (decision
 * Oct 2026): rules, recurring tasks and workspace task templates are seen by
 * the workspace's members only (no global role reads them), managed by its
 * owner/admin; archived workspaces are read-only. Not a member → 404.
 */
final class AutomationAccess
{
    public function role(User $user, Workspace $workspace): ?WorkspaceRole
    {
        if (! $user->isActive() || $workspace->company_id !== $user->company_id) {
            return null;
        }

        $role = $workspace->roleOf($user);

        // Penugasan HR (private tasks): rules and recurring tasks name other
        // people's assignments, so only its owner/admins see automation there.
        if ($workspace->hasPrivateTasks() && ! ($role?->canManage() ?? false)) {
            return null;
        }

        return $role;
    }

    public function isMember(User $user, Workspace $workspace): bool
    {
        return $this->role($user, $workspace) !== null;
    }

    /** Owner/admin of a live workspace (personal: its owner). */
    public function canManage(User $user, Workspace $workspace): bool
    {
        return ! $workspace->isArchived() && ($this->role($user, $workspace)?->canManage() ?? false);
    }

    /** Member (not viewer) of a live workspace: may create tasks. */
    public function canEditTasks(User $user, Workspace $workspace): bool
    {
        return ! $workspace->isArchived() && ($this->role($user, $workspace)?->canEditTasks() ?? false);
    }

    /**
     * Allow when $allowed; otherwise 403 for members (with $message) and 404 for everyone else.
     */
    public function gate(User $user, Workspace $workspace, bool $allowed, string $message): Response
    {
        if ($allowed) {
            return Response::allow();
        }

        return $this->isMember($user, $workspace) ? Response::deny($message) : Response::denyAsNotFound();
    }
}
