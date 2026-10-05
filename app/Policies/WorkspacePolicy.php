<?php

namespace App\Policies;

use App\Domain\Organization\Enums\Permission;
use App\Domain\Organization\Enums\Role;
use App\Domain\Workspaces\Enums\WorkspaceRole;
use App\Domain\Workspaces\Enums\WorkspaceType;
use App\Domain\Workspaces\Enums\WorkspaceVisibility;
use App\Models\User;
use App\Models\Workspace;
use App\Models\WorkspaceMember;
use Illuminate\Auth\Access\Response;

/**
 * Workspace access (docs/ARCHITECTURE.md §4, PRD M3/M10):
 *
 * - Personal: only the owner — not Super Admin, not Direksi.
 * - Shared: members by role (owner > admin > member > viewer); `internal` is
 *   readable by every employee; Direksi (workspaces.view_all) reads all;
 *   Super Admin (workspaces.manage) reads all and manages settings; Kepala
 *   Divisi reads projects with members from their division.
 * - Not allowed to see it → 404 (existence is not revealed); allowed to see
 *   but not to change → 403. Archived workspaces are read-only.
 */
class WorkspacePolicy
{
    public function viewAny(User $user): bool
    {
        return true;
    }

    public function view(User $user, Workspace $workspace): Response
    {
        return $this->canView($user, $workspace) ? Response::allow() : Response::denyAsNotFound();
    }

    /**
     * Team workspaces: Kepala Divisi, Ketua Tim, Super Admin. Projects: also
     * Direksi. Personal and division workspaces are created automatically.
     */
    public function create(User $user, WorkspaceType $type): bool
    {
        $leadsTeam = $user->ledTeams()->exists();
        $base = $user->hasRole(Role::KepalaDivisi) || $leadsTeam || $user->hasPermission(Permission::WorkspacesManage);

        return match ($type) {
            WorkspaceType::Team => $base,
            WorkspaceType::Project => $base || $user->hasRole(Role::Direksi),
            WorkspaceType::Personal, WorkspaceType::Division => false,
        };
    }

    /**
     * Settings: general, columns, labels.
     */
    public function update(User $user, Workspace $workspace): Response
    {
        return $this->gate($user, $workspace, $this->canManage($user, $workspace) && ! $workspace->isArchived());
    }

    public function manageMembers(User $user, Workspace $workspace): Response
    {
        return $this->gate($user, $workspace, ! $workspace->isPersonal() && $this->canManage($user, $workspace) && ! $workspace->isArchived());
    }

    /**
     * Archive / restore: owner or Super Admin; only team and project workspaces.
     */
    public function archive(User $user, Workspace $workspace): Response
    {
        $allowed = in_array($workspace->type, [WorkspaceType::Team, WorkspaceType::Project], true)
            && ($workspace->roleOf($user) === WorkspaceRole::Owner || $user->hasPermission(Permission::WorkspacesManage));

        return $this->gate($user, $workspace, $allowed);
    }

    /**
     * Star in the sidebar (members only).
     */
    public function favorite(User $user, Workspace $workspace): Response
    {
        return $this->gate($user, $workspace, $workspace->roleOf($user) !== null);
    }

    /**
     * Create, edit and move tasks.
     */
    public function editTasks(User $user, Workspace $workspace): Response
    {
        return $this->gate($user, $workspace, $this->canEditTasks($user, $workspace));
    }

    /**
     * /portofolio: Direksi & Super Admin (portfolio.view) and Kepala Divisi
     * (only projects of their divisions, see Workspace::scopePortfolioFor).
     */
    public function viewPortfolio(User $user): bool
    {
        return $user->hasPermission(Permission::PortfolioView) || $user->hasRole(Role::KepalaDivisi);
    }

    /**
     * Project tracking writes (PRD M10): weekly update, milestones and risks.
     * Only the PIC and workspace owners/admins (plus Super Admin).
     */
    public function manageProject(User $user, Workspace $workspace): Response
    {
        return $this->gate($user, $workspace, $this->canManageProject($user, $workspace));
    }

    /**
     * Direksi actions on a project: "Minta update", "Beri arahan",
     * "Tandai keputusan selesai" (portfolio.view: Direksi, Super Admin).
     */
    public function steerProject(User $user, Workspace $workspace): Response
    {
        $allowed = $workspace->isProject()
            && ! $workspace->isArchived()
            && $user->hasPermission(Permission::PortfolioView)
            && $this->canView($user, $workspace);

        return $this->gate($user, $workspace, $allowed);
    }

    public function canManageProject(User $user, Workspace $workspace): bool
    {
        if (! $workspace->isProject() || $workspace->isArchived() || ! $this->canView($user, $workspace)) {
            return false;
        }

        return ($workspace->lead_user_id !== null && $workspace->lead_user_id === $user->id)
            || $this->canManage($user, $workspace);
    }

    public function canView(User $user, Workspace $workspace): bool
    {
        if ($workspace->company_id !== $user->company_id) {
            return false;
        }

        if ($workspace->isPersonal()) {
            return $workspace->owner_id === $user->id;
        }

        if ($workspace->visibility === WorkspaceVisibility::Internal
            || Workspace::seesAllShared($user)
            || $workspace->roleOf($user) !== null) {
            return true;
        }

        return $workspace->type === WorkspaceType::Project && $this->involvesLedDivision($user, $workspace);
    }

    public function canEditTasks(User $user, Workspace $workspace): bool
    {
        if ($workspace->isArchived() || ! $this->canView($user, $workspace)) {
            return false;
        }

        return $workspace->roleOf($user)?->canEditTasks() ?? false;
    }

    public function canManage(User $user, Workspace $workspace): bool
    {
        if (! $this->canView($user, $workspace)) {
            return false;
        }

        if ($workspace->isPersonal()) {
            return $workspace->owner_id === $user->id;
        }

        return ($workspace->roleOf($user)?->canManage() ?? false)
            || $user->hasPermission(Permission::WorkspacesManage);
    }

    private function gate(User $user, Workspace $workspace, bool $allowed): Response
    {
        if ($allowed) {
            return Response::allow();
        }

        return $this->canView($user, $workspace)
            ? Response::deny('Anda tidak punya akses untuk mengubah workspace ini.')
            : Response::denyAsNotFound();
    }

    private function involvesLedDivision(User $user, Workspace $workspace): bool
    {
        if (! $user->hasRole(Role::KepalaDivisi)) {
            return false;
        }

        $divisionIds = $user->ledDivisionIds();

        if ($divisionIds === []) {
            return false;
        }

        // Primary division of the project (Sprint 9) or a member from the division.
        if ($workspace->division_id !== null && in_array($workspace->division_id, $divisionIds, true)) {
            return true;
        }

        return WorkspaceMember::query()
            ->where('workspace_id', $workspace->id)
            ->whereHas('user', fn ($query) => $query->whereIn('division_id', $divisionIds))
            ->exists();
    }
}
