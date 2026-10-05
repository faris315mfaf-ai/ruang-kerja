<?php

namespace App\Policies;

use App\Models\SavedView;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Auth\Access\Response;

/**
 * Saved views (docs/DATABASE.md §4): personal views only for their owner;
 * shared views for everyone who can see the workspace. Sharing needs task
 * edit rights in the workspace. Only the owner edits a view; a shared view
 * may also be removed by a workspace admin.
 */
class SavedViewPolicy
{
    public function __construct(private readonly WorkspacePolicy $workspaces) {}

    public function viewAny(User $user): bool
    {
        return true;
    }

    public function view(User $user, SavedView $view): Response
    {
        if ($view->user_id === $user->id) {
            return Response::allow();
        }

        return $view->is_shared && $view->workspace !== null && $this->workspaces->canView($user, $view->workspace)
            ? Response::allow()
            : Response::denyAsNotFound();
    }

    public function create(User $user, Workspace $workspace, bool $shared = false): Response
    {
        if (! $this->workspaces->canView($user, $workspace)) {
            return Response::denyAsNotFound();
        }

        return ! $shared || $this->workspaces->canEditTasks($user, $workspace)
            ? Response::allow()
            : Response::deny('Hanya anggota yang dapat mengubah tugas yang bisa membagikan tampilan.');
    }

    public function update(User $user, SavedView $view, bool $shared = false): Response
    {
        $visible = $this->view($user, $view);

        if ($visible->denied()) {
            return $visible;
        }

        if ($view->user_id !== $user->id) {
            return Response::deny('Hanya pembuat tampilan yang dapat mengubahnya.');
        }

        return $shared && $view->workspace !== null ? $this->create($user, $view->workspace, true) : Response::allow();
    }

    public function delete(User $user, SavedView $view): Response
    {
        $visible = $this->view($user, $view);

        if ($visible->denied()) {
            return $visible;
        }

        $admin = $view->is_shared && $view->workspace !== null && $this->workspaces->canManage($user, $view->workspace);

        return $view->user_id === $user->id || $admin
            ? Response::allow()
            : Response::deny('Hanya pembuat tampilan atau admin workspace yang dapat menghapusnya.');
    }
}
