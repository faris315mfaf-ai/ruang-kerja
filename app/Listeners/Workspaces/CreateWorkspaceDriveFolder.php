<?php

namespace App\Listeners\Workspaces;

use App\Domain\Google\GoogleFeatures;
use App\Domain\Google\Jobs\CreateDriveFolder;
use App\Events\Workspaces\WorkspaceCreated;

/**
 * New team/project/division workspace → its Shared Drive folder (queued;
 * the job also grants the members access). Personal workspaces get their
 * folder on first use (upload, new document). No-op while Google Drive is
 * not configured — the File tab creates missing folders later.
 */
final class CreateWorkspaceDriveFolder
{
    public function handle(WorkspaceCreated $event): void
    {
        $workspace = $event->workspace;

        if ($workspace->isPersonal() || ! GoogleFeatures::enabled()) {
            return;
        }

        CreateDriveFolder::dispatch($workspace);
    }
}
