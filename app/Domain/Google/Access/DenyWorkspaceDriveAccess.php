<?php

namespace App\Domain\Google\Access;

use App\Domain\Google\Contracts\WorkspaceDriveAccess;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;

/**
 * Fail-closed default until the Workspaces module binds its own
 * WorkspaceDriveAccess (Sprint 7 part B): nobody sees workspace files.
 */
final class DenyWorkspaceDriveAccess implements WorkspaceDriveAccess
{
    public function canView(User $user, string $workspaceId): bool
    {
        return false;
    }

    public function canContribute(User $user, string $workspaceId): bool
    {
        return false;
    }

    public function canManage(User $user, string $workspaceId): bool
    {
        return false;
    }

    public function constrainVisible(Builder $query, User $user, string $workspaceColumn): Builder
    {
        return $query->whereRaw('1 = 0');
    }
}
