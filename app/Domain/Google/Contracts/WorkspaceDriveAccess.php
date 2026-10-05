<?php

namespace App\Domain\Google\Contracts;

use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;

/**
 * Bridge between Drive metadata (drive_files.workspace_id) and workspace
 * authorization, which lives in the Workspaces module. The default binding
 * (DenyWorkspaceDriveAccess) denies everything until the Workspaces module
 * binds an implementation backed by WorkspacePolicy / Workspace::visibleTo().
 */
interface WorkspaceDriveAccess
{
    /**
     * May the user see files/metadata of this workspace?
     */
    public function canView(User $user, string $workspaceId): bool;

    /**
     * May the user add files, documents or folders to this workspace?
     */
    public function canContribute(User $user, string $workspaceId): bool;

    /**
     * May the user remove any file record of this workspace (workspace admins)?
     */
    public function canManage(User $user, string $workspaceId): bool;

    /**
     * Restrict a query to rows whose workspace column is visible to the user.
     *
     * @template TModel of Model
     *
     * @param  Builder<TModel>  $query
     * @return Builder<TModel>
     */
    public function constrainVisible(Builder $query, User $user, string $workspaceColumn): Builder;
}
