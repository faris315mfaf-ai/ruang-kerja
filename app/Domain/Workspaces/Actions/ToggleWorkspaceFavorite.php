<?php

namespace App\Domain\Workspaces\Actions;

use App\Models\User;
use App\Models\Workspace;
use App\Models\WorkspaceMember;

/**
 * Stars/unstars a workspace for one member; favorites come first in the sidebar.
 */
final class ToggleWorkspaceFavorite
{
    public function handle(Workspace $workspace, User $user, bool $favorite): void
    {
        WorkspaceMember::query()
            ->where('workspace_id', $workspace->id)
            ->where('user_id', $user->id)
            ->update(['favorited_at' => $favorite ? now() : null, 'updated_at' => now()]);
    }
}
