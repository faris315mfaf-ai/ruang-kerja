<?php

namespace App\Listeners\Workspaces;

use App\Domain\Google\Events\DrivePermissionsSynced;
use App\Domain\Workspaces\Services\WorkspaceDriveAccessRecorder;
use App\Models\Workspace;

/**
 * Stores the confirmed Drive access per member ("Akses Drive" column).
 */
final class RecordWorkspaceDriveAccess
{
    public function __construct(private readonly WorkspaceDriveAccessRecorder $recorder) {}

    public function handle(DrivePermissionsSynced $event): void
    {
        if ($event->owner instanceof Workspace) {
            $this->recorder->synced($event->owner, $event->members, $event->result);
        }
    }
}
