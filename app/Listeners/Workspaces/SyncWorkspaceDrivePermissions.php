<?php

namespace App\Listeners\Workspaces;

use App\Domain\Google\GoogleFeatures;
use App\Domain\Google\Jobs\SyncDrivePermissions;
use App\Events\Workspaces\WorkspaceMembersChanged;
use App\Models\Workspace;

/**
 * Members added, removed or re-roled → folder permissions follow (queued,
 * bursts collapse into one sync). Only when the folder exists: creating it
 * grants access to everyone who is a member at that time.
 */
final class SyncWorkspaceDrivePermissions
{
    public function handle(WorkspaceMembersChanged $event): void
    {
        if (! GoogleFeatures::enabled()) {
            return;
        }

        // The event's model may predate the folder (created by a queued job).
        $folderId = Workspace::query()->whereKey($event->workspace->id)->value('drive_folder_id');

        if ($folderId === null) {
            return;
        }

        SyncDrivePermissions::dispatch($event->workspace);
    }
}
