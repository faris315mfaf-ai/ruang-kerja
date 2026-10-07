<?php

namespace App\Policies;

use App\Domain\Automation\Services\AutomationAccess;
use App\Domain\Organization\Enums\Permission;
use App\Domain\Workspaces\Enums\WorkspaceType;
use App\Models\User;
use App\Models\Workspace;
use App\Models\WorkspaceTemplate;
use Illuminate\Auth\Access\Response;

/**
 * Workspace templates (F2-4): company-wide. Saved from Pengaturan workspace by
 * the owner/admin of a team or project workspace; used by whoever may create
 * a workspace of that type (WorkspacePolicy::create); deleted by their
 * creator or Super Admin.
 */
class WorkspaceTemplatePolicy
{
    public function __construct(
        private readonly AutomationAccess $access,
        private readonly WorkspacePolicy $workspaces,
    ) {}

    public function viewAny(User $user): bool
    {
        return $user->isActive();
    }

    public function view(User $user, WorkspaceTemplate $template): Response
    {
        return $this->canView($user, $template) ? Response::allow() : Response::denyAsNotFound();
    }

    /**
     * "Simpan sebagai template" from $source.
     */
    public function create(User $user, Workspace $source): Response
    {
        $allowed = in_array($source->type, [WorkspaceType::Team, WorkspaceType::Project], true)
            && $this->access->canManage($user, $source);

        return $this->access->gate($user, $source, $allowed, 'Hanya owner atau admin workspace tim atau proyek yang bisa menyimpannya sebagai template.');
    }

    public function use(User $user, WorkspaceTemplate $template): Response
    {
        if (! $this->canView($user, $template)) {
            return Response::denyAsNotFound();
        }

        return $this->workspaces->create($user, $template->type)
            ? Response::allow()
            : Response::deny('Anda tidak bisa membuat workspace jenis ini.');
    }

    public function delete(User $user, WorkspaceTemplate $template): Response
    {
        if (! $this->canView($user, $template)) {
            return Response::denyAsNotFound();
        }

        return $template->created_by === $user->id || $user->hasPermission(Permission::WorkspacesManage)
            ? Response::allow()
            : Response::deny('Hanya pembuat template yang bisa menghapusnya.');
    }

    private function canView(User $user, WorkspaceTemplate $template): bool
    {
        return $user->isActive() && $template->company_id === $user->company_id;
    }
}
