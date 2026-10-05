<?php

namespace App\Policies;

use App\Domain\Google\Contracts\WorkspaceDriveAccess;
use App\Models\DriveFile;
use App\Models\User;
use Illuminate\Auth\Access\Response;

/**
 * Drive metadata follows workspace access (WorkspaceDriveAccess, bound by
 * the Workspaces module). Global roles grant nothing by themselves: even a
 * Super Admin cannot read files of a personal workspace that is not theirs.
 */
class DriveFilePolicy
{
    public function __construct(private readonly WorkspaceDriveAccess $access) {}

    /**
     * Gate::authorize('viewAny', [DriveFile::class, $workspaceId]).
     */
    public function viewAny(User $user, string $workspaceId): bool
    {
        return $this->access->canView($user, $workspaceId);
    }

    public function view(User $user, DriveFile $file): bool
    {
        return $file->workspace_id !== null && $this->access->canView($user, $file->workspace_id);
    }

    /**
     * Upload, create documents/folders: Gate::authorize('create', [DriveFile::class, $workspaceId]).
     */
    public function create(User $user, string $workspaceId): Response
    {
        return $this->access->canContribute($user, $workspaceId)
            ? Response::allow()
            : Response::deny('Anda tidak punya akses untuk menambah file di workspace ini.');
    }

    /**
     * Remove the cached record (and, in part B, the Drive file): the person
     * who added it while still a contributor, or a workspace admin.
     */
    public function delete(User $user, DriveFile $file): bool
    {
        if ($file->workspace_id === null) {
            return false;
        }

        if ($this->access->canManage($user, $file->workspace_id)) {
            return true;
        }

        return $file->added_by === $user->id && $this->access->canContribute($user, $file->workspace_id);
    }
}
