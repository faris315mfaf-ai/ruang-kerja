<?php

namespace App\Domain\Google\Actions;

use App\Domain\Google\GoogleFeatures;
use App\Domain\Google\Jobs\SyncDrivePermissions;
use App\Models\User;
use App\Models\Workspace;
use App\Models\WorkspaceMember;

/**
 * Re-syncs the Drive folder permissions of every workspace the user belongs to
 * (only workspaces that already have a folder). Used when the person's status
 * changes: `Workspace::driveMembers()` skips inactive users, so a sync after
 * deactivation revokes their access and a sync after reactivation restores it.
 *
 * Jobs are dispatched after the surrounding transaction commits so the sync
 * reads the new status.
 */
final class SyncUserDriveAccess
{
    /**
     * @return int number of workspaces queued
     */
    public function handle(User $user): int
    {
        if (! GoogleFeatures::enabled($user->company_id)) {
            return 0;
        }

        $workspaces = Workspace::query()
            ->whereNotNull('drive_folder_id')
            ->whereIn('id', WorkspaceMember::query()->select('workspace_id')->where('user_id', $user->id))
            ->get();

        foreach ($workspaces as $workspace) {
            SyncDrivePermissions::dispatch($workspace)->afterCommit();
        }

        return $workspaces->count();
    }
}
