<?php

namespace App\Policies;

use App\Domain\Automation\Services\AutomationAccess;
use App\Domain\Organization\Enums\Permission;
use App\Domain\Workspaces\Enums\WorkspaceType;
use App\Models\TaskTemplate;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Auth\Access\Response;

/**
 * Task templates (F2-4).
 *
 * - Company-wide (workspace_id null): every active employee sees and uses them
 *   in workspaces where they may create tasks; created by the people who may
 *   start team/project workspaces (Kepala Divisi, Ketua Tim, Direksi, Super
 *   Admin); changed/deleted by their creator or Super Admin.
 * - Workspace templates: seen by its members, used inside that workspace
 *   only, managed by its owner/admin.
 */
class TaskTemplatePolicy
{
    public function __construct(
        private readonly AutomationAccess $access,
        private readonly WorkspacePolicy $workspaces,
    ) {}

    public function viewAny(User $user): bool
    {
        return $user->isActive();
    }

    public function view(User $user, TaskTemplate $template): Response
    {
        return $this->canView($user, $template) ? Response::allow() : Response::denyAsNotFound();
    }

    public function create(User $user, ?Workspace $workspace = null): Response
    {
        if ($workspace !== null) {
            return $this->access->gate($user, $workspace, $this->access->canManage($user, $workspace), 'Hanya owner atau admin workspace yang bisa menyimpan template di workspace ini.');
        }

        return $this->canCreateCompanyWide($user)
            ? Response::allow()
            : Response::deny('Template untuk semua workspace dibuat oleh Kepala Divisi, Ketua Tim, atau Direksi.');
    }

    public function update(User $user, TaskTemplate $template): Response
    {
        if (! $this->canView($user, $template)) {
            return Response::denyAsNotFound();
        }

        if ($template->workspace !== null) {
            return $this->access->gate($user, $template->workspace, $this->access->canManage($user, $template->workspace), 'Hanya owner atau admin workspace yang bisa mengubah template ini.');
        }

        return $template->created_by === $user->id || $user->hasPermission(Permission::WorkspacesManage)
            ? Response::allow()
            : Response::deny('Hanya pembuat template yang bisa mengubahnya.');
    }

    public function delete(User $user, TaskTemplate $template): Response
    {
        return $this->update($user, $template);
    }

    /**
     * "Pakai template" into $target.
     */
    public function use(User $user, TaskTemplate $template, Workspace $target): Response
    {
        if (! $this->canView($user, $template)) {
            return Response::denyAsNotFound();
        }

        if ($template->workspace_id !== null && $template->workspace_id !== $target->id) {
            return Response::deny('Template ini hanya untuk workspace asalnya.');
        }

        return $this->access->gate($user, $target, $this->access->canEditTasks($user, $target), 'Anda tidak bisa membuat tugas di workspace ini.');
    }

    public function canCreateCompanyWide(User $user): bool
    {
        return $user->isActive() && $this->workspaces->create($user, WorkspaceType::Project);
    }

    private function canView(User $user, TaskTemplate $template): bool
    {
        if (! $user->isActive() || $template->company_id !== $user->company_id) {
            return false;
        }

        return $template->workspace === null || $this->access->isMember($user, $template->workspace);
    }
}
