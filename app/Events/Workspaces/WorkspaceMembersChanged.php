<?php

namespace App\Events\Workspaces;

use App\Models\Workspace;
use Illuminate\Contracts\Events\ShouldDispatchAfterCommit;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

/**
 * Members of a workspace were added, removed or changed role (manually or by
 * the division/team sync). Sprint 7 listens to queue SyncDrivePermissions.
 */
final class WorkspaceMembersChanged implements ShouldDispatchAfterCommit
{
    use Dispatchable, SerializesModels;

    /**
     * @param  list<string>  $addedUserIds
     * @param  list<string>  $removedUserIds
     */
    public function __construct(
        public Workspace $workspace,
        public array $addedUserIds = [],
        public array $removedUserIds = [],
    ) {}
}
