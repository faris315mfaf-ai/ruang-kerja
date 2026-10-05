<?php

namespace App\Listeners\Workspaces;

use App\Domain\Google\Events\DrivePermissionsSyncFailed;
use App\Domain\Workspaces\Services\WorkspaceDriveAccessRecorder;
use App\Models\Workspace;

/**
 * The permission sync gave up: members still waiting show "Gagal".
 */
final class RecordWorkspaceDriveAccessFailure
{
    public function __construct(private readonly WorkspaceDriveAccessRecorder $recorder) {}

    public function handle(DrivePermissionsSyncFailed $event): void
    {
        if ($event->owner instanceof Workspace) {
            $this->recorder->failed($event->owner, $event->reason);
        }
    }
}
