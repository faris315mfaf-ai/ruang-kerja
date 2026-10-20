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

        // Penugasan HR (private tasks) gets its folder on first use, shared with HR admins only (driveMembers()).
        if ($workspace->isPersonal() || $workspace->hasPrivateTasks() || ! GoogleFeatures::enabled($workspace->company_id)) {
            return;
        }

        CreateDriveFolder::dispatch($workspace);
    }
}
