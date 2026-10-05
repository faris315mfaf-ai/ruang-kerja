<?php

namespace App\Domain\Workspaces\Actions;

use App\Domain\Google\GoogleFeatures;
use App\Domain\Google\Jobs\CreateDriveFolder;
use App\Domain\Google\Jobs\SyncDriveFolderContents;
use App\Domain\Google\Services\DriveFolderContentsSync;
use App\Models\Workspace;

/**
 * Keeps the File/Dokumen tabs fresh when they are opened:
 * - a shared workspace without a folder (created before Drive was
 *   configured, or the job failed) gets CreateDriveFolder queued;
 * - a folder level whose cache is older than 5 minutes (or `$force`, the
 *   "Muat ulang" button) gets SyncDriveFolderContents queued.
 * Both jobs are unique, so repeated visits do not pile up.
 *
 * @return bool true while Drive work is queued (the page polls)
 */
final class RefreshWorkspaceDrive
{
    public function __construct(private readonly DriveFolderContentsSync $contents) {}

    public function handle(Workspace $workspace, ?string $folderId = null, bool $force = false): bool
    {
        if (! GoogleFeatures::enabled()) {
            return false;
        }

        if ($workspace->drive_folder_id === null) {
            if ($workspace->isPersonal()) {
                return false; // created on first use
            }

            CreateDriveFolder::dispatch($workspace);

            return $workspace->fresh()?->drive_folder_id === null;
        }

        $folderId ??= $workspace->drive_folder_id;

        if ($force) {
            $this->contents->markStale($folderId);
        }

        if (! $this->contents->isStale($folderId)) {
            return false;
        }

        SyncDriveFolderContents::dispatch($workspace->id, $folderId);

        return $this->contents->isStale($folderId);
    }
}
